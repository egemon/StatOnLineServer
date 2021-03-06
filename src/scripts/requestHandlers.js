var querystring = require("querystring"),
    fs = require("fs"),
    formidable = require("formidable"),
    ejs = require('ejs'),
    XLSX = require('xlsx');

var DEST_PATH = '/tmp/test.xlsx';


function render (tmplUrl, res, scope) {
    fs.readFile(tmplUrl, function (err, tmpl){
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(ejs.render(tmpl + '', scope));
        res.end();
    });
}

function handleWindowsError (originPath, destPath) {

    /* Возможна ошибка в Windows: попытка переименования уже существующего файла */
    fs.rename(originPath, destPath, function(err) {
      if (err) {
        fs.unlink(destPath);
        fs.rename(originPath, destPath);
      }
    });
}

function parseXLS (wb) {
    var sheets = wb.Sheets;
    var dataSet = {};
    var varNames = [];
    for (var key in sheets){
        dataSet[key] = [];
        var sheet = sheets[key];
        varNames = [];
        delete sheet['!ref'];
        var nowVar = -1;
        for (var cellKey in sheet) {

            nowVar++;
            var cell = sheet[cellKey];

            //cell.h means text cell == variable name
            if (cell.h) {
                dataSet[key][cell.h] = [];
                varNames.push(cell.h);
            } else {
                dataSet[key][varNames[(nowVar % varNames.length)]].push(cell.v);
            }
        }
    }

    return {
        workBook: dataSet,
        VariablesNames: varNames
    };
}


//FIRST PAGE
function start(res) {
    render('src/tmpls/index.html', res);
}

function upload(res, request) {
    var form = new formidable.IncomingForm();
    console.log("about to parse");
    form.parse(request, function(error, fields, files) {
        console.log("parsing done");

        handleWindowsError(files.upload.path, DEST_PATH);

        var wb = XLSX.readFile(DEST_PATH, {encoding:'base64'});

        global.workBook = parseXLS(wb).workBook;
        global.VariablesNames = parseXLS(wb).VariablesNames;

        render('src/tmpls/upload.html', res, {
            selects: [
                {
                    name: 'variable',
                    title: 'Choose reseraching variable'
                },{
                    name: 'concentration1',
                    title: 'Choose concentration 1 variable'
                },{
                    name: 'concentration2',
                    title: 'Choose concentration 2 variable'
                }],
            VariablesNames: VariablesNames
        });
    });

}

function choose(response, request) {
    var form = new formidable.IncomingForm();
    form.parse(request, function(error, fields, files) {
    response.writeHead(200, {"Content-Type": "text/html"});
    global.concentrations = [];


    var topPage = '<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>infoChoose</title></head><body><div class = "head" style="font-size:20px">Choose needed information</div><form class="form-horizontal" action="/result" enctype="multipart/form-data" method="post"><div class="form-group"><label for="group" class="col-sm-2 control-label">Choose group</label><div class="col-sm-10"><select class="form-control" name="group">';
    response.write(topPage);
    for (var key in fields) {
        if (key === 'variable') {continue;}
        response.write('<option>');
        response.write(fields[key]);
        response.write('</option>');
    }
    var bottomPage = '</select></div></div><div class="form-group"><div class="col-sm-offset-2 col-sm-10"><div class="checkbox"><label><input type="checkbox" name="distribution">Distribution function</label></div><div class="checkbox"><label><input type="checkbox" name="density">Density function</label></div><div class="checkbox"><label><input type="checkbox" name="box">Box and whisker plot</label></div><div class="checkbox"><label><input type="checkbox" name="numbers">Number characteristics</label></div></div></div></div><div class="form-group"><div class="col-sm-offset-2 col-sm-10"><button type="submit" class="btn btn-success">Show</button><button type="cancel" class="btn btn-warning">Cancel</button></div></div></form></body></html>';
    response.write(bottomPage);
    response.end();

    global.variableName = fields.variable;
    delete fields.variable;
        global.concentrations = [];
        for (key in fields) {
            global.concentrations.push(fields[key]);
        }
    });
}

function result(response, request) {
    var form = new formidable.IncomingForm();
    form.parse(request, function(error, fields, files) {
    for (var key in workBook) {
        global.list1 = key;
    }
    response.writeHead(200, {"Content-Type": "text/html"});
    var topPage = '';
    response.write(topPage);

    //формирование матрицы для подсчета определителя
    var G = [];
    var n = global.workBook[global.list1][global.concentrations[0]].length;
    for (var i = 0; i < global.concentrations.length; i++) {
      G.push([]);
        for (var j = 0; j < global.concentrations.length; j++) {
          var result = 0;
          for (var k = 0; k < global.workBook[global.list1][global.concentrations[i]].length; k++) {
            result += global.workBook[global.list1][global.concentrations[i]][k]*global.workBook[global.list1][global.concentrations[j]][k];
          }
            G[i][j] = result/n;
        }
    }
    //определяем по чем нам показывать данные
    var currentGroup = fields.group;
    //удалить название переменной, оставить только парметры анализа
    delete fields.group;
    //вычисление коеффициентов
    var det = determinant(G);
    //это цикл по всем видам групп людей (к-тая группа)
    global.koeffs = {};
    for (var k = 1; k <= global.concentrations.length; k++) {
        global.koeffs[global.concentrations[k-1]] = [];
        //этот цикл по всем показателям в к-той группе j-тое наблюдение
        for (var j = 0; j < global.workBook[global.list1][global.concentrations[k-1]].length; j++) {
            //для всех данных текущей группы
            var koef = 1/det;
            // в этом цикле идет подсчет суммы
            var sum = 0;
            for (var m = 1; m <= global.concentrations.length; m++) {
                sum += Math.pow(-1, m + k) * Minor(G, k, m) * global.workBook[global.list1][global.concentrations[m-1]][j];
            }
            koef *= sum;
        global.koeffs[global.concentrations[k-1]].push(koef);
        }
    }
    var data = global.workBook[global.list1][global.variableName];
    var sort = sort(data, global.koeffs[currentGroup]);

    function sort (data, koefs) {
        var result = [];
        for (var i = 0; i < data.length; i++) {
            result.push([data[i],koefs[i]]);
        }
        result.sort(function  (x,y) {
            return x[0]-y[0];
        });
        var sortData = [];
        var sortKoefs = [];
        for (i = 0; i < data.length; i++) {
            sortData[i] = result[i][0];
            sortKoefs[i] = result[i][1];
        }
        return {"sortData": sortData , "sortKoefs": sortKoefs};
    }

    var max = -Infinity;
    var min = Infinity;
    var topQuantile;
    var bottomQuantile;
    var mediana;
    var EX = expectation(sort);
    var DX = variation(sort, EX);
    var r = createDistrFunction (sort.sortData, sort.sortKoefs);
    function createDistrFunction (data, koefs) {
        var k = 1/data.length;
        var sum = 0;
        var minY = koefs[0]*k;
        var maxY = koefs[0]*k;
        var minX = Math.min.apply(null,data);
        var maxX = Math.max.apply(null,data);
        var Y = [];


        for (var i = 0; i < data.length; i++) {
            sum+=koefs[i]*k;
            Y.push(sum);
            bottomQuantile =  quantile(Y, data, i, 1/4) !== undefined ? quantile(Y, data, i, 1/4)  : bottomQuantile;
            mediana =  quantile (Y, data, i, 1/2) !== undefined ? quantile (Y, data, i, 1/2)  : mediana;
            topQuantile =  quantile(Y, data, i, 3/4) !== undefined ? quantile(Y, data, i, 3/4)  : topQuantile;
            minY = Math.min(minY, sum);
            maxY = Math.max(maxY, sum);
            if (minY === sum) {
                min = data[i];
            }
            if (maxY === sum) {
                max = data[i];
            }

        }
        console.log(' Y = ',Y);
        console.log(' data = ',data);
        return [Y, minY ,maxY ,minX ,maxX];
    }

    function quantile (Y, data, i, level) {
        if (Y[i] == level) {
            return data[i];
        }
        if (Y[i] > level && Y[i-1] <level) {
            return (data[i] + data[i-1])/2;
        }
    }


    console.log('fields = ', fields);
    for (var key in fields) {
        switch (key) {
            case 'numbers':
                response.write('<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>Result</title></head><body><div class = "head" style="font-size:20px">Numbers Results for '+currentGroup+'</div>');
                response.write('<table class="table table-bordered table-striped" style="width: 32%"><thead><tr><th>Number</th><th>Value</th></tr></thead>'+
                    '<tbody><tr><td><span class="label label-primary">EX = </span></td><td>'+ EX +
                    '</td></tr><tr><td><span class="label label-success">VAR = </span></td><td>'+ DX +
                    '</td></tr><tr><td><span class="label label-warning">MAX = </span></td><td>'+ max +
                    '</td></tr><tr><td><span class="label label-danger">MIN = </span></td><td>'+ min +
                    '</td></tr><tr><td><span class="label label-info">topQuantile = </span></td><td>'+ topQuantile +
                    '</td></tr><tr><td><span class="label label-danger">mediana = </span></td><td>'+ mediana +
                    '</td></tr><tr><td><span class="label label-default">bottomQuantile = </span></td><td>' + bottomQuantile +
                    '</td></tr></tbody></table>');
                response.write('<div style = "height: 40px; width: 100%"></div>');



            break;
            case 'distribution':
                response.write('<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>Result</title></head><body><div class = "head" style="font-size:20px">Distribution function for '+currentGroup+'</div>');
                response.write('<style>#wrap-dist{ display:inline-block; position:relative; cursor:pointer; } #hint{ background-color:#abc; color:#fed; position:absolute; font-size:10px; } </style><div id="wrap-dist"><canvas id="distr" width="500" height="500"></canvas></div>');
                response.write('<script>var r=[['+r[0]+'],'+r[1]+','+r[2]+','+r[3]+','+r[4]+',['+sort.sortData+']];</script>');
                response.write('<script>var w = screen.height;var canvas = document.getElementById("distr");canvas.setAttribute("style","transform: matrix(1,0,0,-1,0,0)");canvas.setAttribute("width",w);canvas.setAttribute("height",w);drowFunction(r[0], r[5], w, r[1], r[2], r[3], r[4], "#000");function drowFunction (Y, data, w, minY ,maxY ,minX ,maxX, color) {var Kx = w/(maxX - minX);var Ky = w/(maxY - minY);drowGraphic (Y, data, w, minY ,maxY ,minX ,maxX, color, Kx, Ky);createHint (Kx ,minX ,Ky ,minY);}function drowGraphic (Y, data, w, minY ,maxY ,minX ,maxX, color, Kx, Ky) {var context = document.getElementById("distr").getContext("2d");if (context) {context.strokeStyle = color;context.lineWidth = 1;context.beginPath();var canvasPointsY = [];var canvasPointsX = [];for (var i = 0; i < data.length; i++) {canvasPointsX[i] = (data[i] - minX)*Kx;canvasPointsY[i] = (Y[i] - minY)*Ky;context.lineTo(canvasPointsX[i],canvasPointsY[i]);context.moveTo(canvasPointsX[i],canvasPointsY[i]);}context.stroke();context.closePath();createDecart("#3ac", -minX*Kx, -minY*Ky, w);}}function createHint (Kx ,minX ,Ky ,minY) {var div = document.createElement("div");div.id = "hint";document.getElementById("wrap-dist").appendChild(div);div.hidden = true;document.getElementById("distr").addEventListener("mousemove",function(ev){div.hidden = false;var x = ev.offsetX/Kx+minX;var y = ev.offsetY/Ky+minY;div.style.bottom = ev.offsetY + "px";div.style.left = ev.offsetX + "px";div.innerHTML = "X = " + x.toFixed(2);div.innerHTML += "Y = " + y.toFixed(2);});}function createDecart (color, x, y, w) {var canvas = document.getElementById("distr");var context = canvas.getContext("2d");if (context) {context.strokeStyle = color;context.lineWidth = 1;context.beginPath();context.moveTo(0, y);context.lineTo(w, y);context.moveTo(w-10, y);context.lineTo(10, y);context.moveTo(w - 20, y - 10);context.lineTo(w - 10, y);context.lineTo(w - 20, y + 10);context.moveTo(x - 10, y - 20);context.lineTo(x, y - 10);context.lineTo(x + 10, y - 20);context.stroke();context.closePath();}}</script>');
            break;
            case 'density':
                var kernel = function(x) {
                    return 1/Math.PI*Math.exp(-0.5*Math.pow(x,2));
                };

                var densityFunction  = function(x, k, observations, koefs, kernel) {
                    var N = observations.length;
                    var result = 0;
                    for (var i = 0; i < N; i++) {
                        result += koefs[i]*kernel((x - observations[i])/k);
                    }
                    result = result/(N*k);
                    return result;
                };

                var Y = [];
                var X = sort.sortData;
                var koefs = sort.sortKoefs;
                //fix due to observations.length
                var k = 0.001;
                for (var i = 0; i < X.length; i++) {
                   Y.push(densityFunction(X[i], k, X, koefs, kernel));
                }

                response.write('<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>Result</title></head><body><div class = "head" style="font-size:20px">Density function for '+currentGroup+'</div>');
                response.write('<style>#wrap-dens{ display:inline-block; position:relative; cursor:pointer; } #hint-dens{ background-color:#abc; color:#fed; position:absolute; font-size:10px; } </style><div id="wrap-dens"><canvas id="dens" width="500" height="500"></canvas></div>');
                response.write('<script>var Y = [' + Y + '], X = [' + X +'];</script>');
                response.write('<script>var w = screen.height;var canvas = document.getElementById("dens");canvas.setAttribute("style","transform: matrix(1,0,0,-1,0,0)");canvas.setAttribute("width",w);canvas.setAttribute("height",w);</script>');
            break;
            case 'box':
                response.write('<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>Result</title></head><body><div class = "head" style="font-size:20px">Box and whiskers plot for '+currentGroup+'</div>');
                response.write('<style>#wrap-box{ display:inline-block; position:relative; cursor:pointer; } #hint-box{ background-color:#abc; color:#fed; position:absolute; font-size:10px; } </style><div id="wrap-box"><canvas id="box" width="500" height="500"></canvas></div>');
                response.write('<script>var EX ='+EX+' , VAR ='+DX+', MAX ='+max+' , MIN =   '+min+' , topQuantile =   '+topQuantile+' , mediana =   '+mediana+' , bottomQuantile =    '+bottomQuantile+'  ;</script>');
                response.write('<script>var w = screen.height/3;var canvas = document.getElementById("box");canvas.setAttribute("style","transform: matrix(1,0,0,-1,0,0)");canvas.setAttribute("width",w);canvas.setAttribute("height",w);drowBox( EX, VAR, MAX, MIN, topQuantile, mediana, bottomQuantile, "#000");function drowBox ( EX, VAR, MAX, MIN, topQuantile, mediana, bottomQuantile, color) {var Ky = w/(MAX - MIN);createHint (Ky ,MIN);EX = (EX-MIN)*Ky;VAR = (VAR-MIN)*Ky;MAX = (MAX-MIN)*Ky;topQuantile = (topQuantile-MIN)*Ky;mediana = (mediana-MIN)*Ky;bottomQuantile = (bottomQuantile-MIN)*Ky;MIN = (MIN-MIN)*Ky;drowBoxGraphic (EX, VAR, MAX, MIN, topQuantile, mediana, bottomQuantile, color, Ky);}function drowBoxGraphic (EX, VAR, MAX, MIN, topQuantile, mediana, bottomQuantile, color) {var context = document.getElementById("box").getContext("2d");if (context) {context.strokeStyle = color;context.lineWidth = 1;context.beginPath();context.moveTo(w/2-10,MIN);context.lineTo(w/2+10,MIN);context.moveTo(w/2,MIN);context.lineTo(w/2,bottomQuantile);context.strokeRect(w/2-10, bottomQuantile, 20, topQuantile-bottomQuantile);context.moveTo(w/2-10,mediana);context.lineTo(w/2+10,mediana);context.moveTo(w/2,topQuantile);context.lineTo(w/2,MAX);context.moveTo(w/2-10,MAX);context.lineTo(w/2+10,MAX);context.moveTo(w/2,EX);context.arc(w/2, EX, Math.sqrt(VAR)|| 10 , 0, 2*Math.PI, false);context.stroke();context.closePath();}}function createHint (Ky ,MIN) {var div = document.createElement("div");div.id = "hint-box";document.getElementById("wrap-box").appendChild(div);div.hidden = true;document.getElementById("box").addEventListener("mousemove",function(ev){div.hidden = false;var y = ev.offsetY/Ky+MIN;div.style.bottom = ev.offsetY + "px";div.style.left = ev.offsetX + "px";div.innerHTML = "Y = " + y.toFixed(2);});}</script>');
            break;
        }
    }
    response.end();
    });
}







exports.start = start;
exports.upload = upload;
exports.choose = choose;
exports.result = result;

//Функция для вычисления определителя матрицы A
function determinant(A){
var n = A.length, subA = [], detA = 0;
if (n===1) {return A[0][0];}
for (var i=0; i<n; i++)
    { for (var h=0; h<n-1; h++) {subA[h]=[];}
      for (var a=1; a<n; a++)
          { for (var b=0; b<n; b++)
                { if (b<i)       {subA[a-1][ b ] = A[ a ][ b ];}
                  else if (b>i)  {subA[a-1][b-1] = A[ a ][ b ];}
                }
          }
      var sign = (i%2===0) ? 1 : -1;
      detA += sign * A[0][i] * determinant(subA);
    }
return detA;
}

//Функция для вычисления дополняющего минор
function Minor(matrix,stol,stro){
  var result = [];
  var k = 0;
  var l = 0;
  for(var i = 0; i  <  matrix.length; i++){
        if (i===stol - 1) {
            k=1;
            continue;
        }
        result[i-k] = [];

        for(var j =0;j < matrix[i].length;j++){
            if (j===stro - 1) {
                l=1;
                continue;
            }
            result[i-k][j-l] = matrix[i][j];
        }
        l=0;
    }
  return determinant(result);
}

function expectation (sort) {
    var result = 0;
    for (var i = 0; i < sort.sortKoefs.length; i++) {
        result+=sort.sortKoefs[i]*sort.sortData[i];
    }
    return result/sort.sortKoefs.length;
}

function variation (sort, EX) {
    var result = 0;
    for (var i = 0; i < sort.sortKoefs.length; i++) {
        result=result + (sort.sortKoefs[i] * Math.pow(sort.sortData[i] - EX, 2));
    }
    return result/sort.sortKoefs.length;
}

function createSample (sort) {
    var result = [];
    for (var i = 0; i < sort.sortKoefs.length; i++) {
        result[i] = sort.sortKoefs[i] * sort.sortData[i];
    }
    return result;
}

