var querystring = require("querystring"),
    fs = require("fs"),
    formidable = require("formidable"),
    XLSX = require('xlsx');
var Columns = ['A','B','C','D','E'];

function start(response) {
  console.log("Request handler 'start' was called.");

  var body = '<html>'+
    '<head>'+
    '<meta http-equiv="Content-Type" '+
    'content="text/html; charset=UTF-8" />'+
    '</head>'+
    '<body>'+
    '<form action="/upload" enctype="multipart/form-data" '+
    'method="post">'+
    '<input type="file" name="upload" multiple="multiple">'+
    '<input type="submit" value="Загрузить" />'+
    '</form>'+
    '</body>'+
    '</html>';

    response.writeHead(200, {"Content-Type": "text/html"});
    response.write(body);
    response.end();
};

var workBook = {};
function upload(response, request) {
    console.log("Request handler 'upload' was called.");
    var form = new formidable.IncomingForm();
    console.log("about to parse");
    form.parse(request, function(error, fields, files) {
        console.log("parsing done");

        /* Возможна ошибка в Windows: попытка переименования уже существующего файла */
        fs.rename(files.upload.path, "/tmp/test.xlsx", function(err) {
          if (err) {
            fs.unlink("/tmp/test.xlsx");
            fs.rename(files.upload.path, "/tmp/test.xlsx");
          }
        });

        //парсинг и записывание данных в массив
        response.writeHead(200, {"Content-Type": "text/html"});
        var wb = XLSX.readFile('/tmp/test.xlsx', {encoding:'base64'});
        var allData = [];

        for (var list in wb['Sheets']){
            workBook[list]=[];
            // workBook[list].dataRange = wb['Sheets'][list]['!ref'] ;
            delete wb['Sheets'][list]['!ref'];
            var varQnt=0;
            var nowVar=-1;
            var VariablesNames = [];
            for (var data in wb['Sheets'][list]){ 
                    nowVar++;
                if (wb['Sheets'][list][data]['h']) {
                    workBook[list][wb['Sheets'][list][data]['h']] = [];
                    VariablesNames.push(wb['Sheets'][list][data]['h']);
                }else {
                    workBook[list][VariablesNames[(nowVar%VariablesNames.length)]].push(wb['Sheets'][list][data]['v']);
                };
            };
        };
        global.workBook = workBook;
        global.VariablesNames = VariablesNames;
        console.log('workBook == ', workBook);


        html = createChooseVariablePage(VariablesNames);
        function createChooseVariablePage(VariablesNames) {
            var result = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script></head><body><form action="/choose" enctype="multipart/form-data" method="post"><div class = "head" style="font-size:20px">Choose reseraching variable</div><select name="variable" class="form-control">';
            for (var i = 0; i < VariablesNames.length; i++) {
                    result+= '<option>'+VariablesNames[i]+'</option>';
                };
            result+='</select>'; 
            result += '<div class = "head" style="font-size:20px">Choose concentration 1 variable</div><select name = "concentration1" class="form-control">'; 
            for (var i = 0; i < VariablesNames.length; i++) {
                    result+= '<option>'+VariablesNames[i]+'</option>';
                };
            result+='</select>'; 
            result += '<div class = "head" style="font-size:20px">Choose concentration 2 variable</div><select name = "concentration2" class="form-control">';
            for (var i = 0; i < VariablesNames.length; i++) {
                    result+= '<option>'+VariablesNames[i]+'</option>';
                };
            result+='</select>';

            result+='<input type="submit" value="choose"/> '
            result+='</form>'+'</body>'+'</html>';
            return result;
        };


        response.writeHead(200, {"Content-Type": "text/html"});
        response.write(html);
        response.end();


    });
};

function choose(response, request) {
    var form = new formidable.IncomingForm();
    form.parse(request, function(error, fields, files) {
    console.log('fields == ', fields);
    response.writeHead(200, {"Content-Type": "text/html"});
    global.concentrations = [];


    var topPage = '<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css"><script src="http://ajax.googleapis.com/ajax/libs/jquery/1/jquery.min.js"></script><title>infoChoose</title></head><body><div class = "head" style="font-size:20px">Choose needed information</div><form class="form-horizontal" action="/result" enctype="multipart/form-data" method="post"><div class="form-group"><label for="group" class="col-sm-2 control-label">Choose group</label><div class="col-sm-10"><select class="form-control" name="group">';
    response.write(topPage);
    for (var key in fields) {
        if (key == 'variable') {continue};
        response.write('<option>');
        response.write(fields[key]);
        response.write('</option>');
    };
    var bottomPage = '</select></div></div><div class="form-group"><div class="col-sm-offset-2 col-sm-10"><div class="checkbox"><label><input type="checkbox" name="distribution">Distribution function</label></div><div class="checkbox"><label><input type="checkbox" name="density">Density function</label></div><div class="checkbox"><label><input type="checkbox" name="box">Box and whisker plot</label></div><div class="checkbox"><label><input type="checkbox" name="numbers">Number characteristics</label></div></div></div></div><div class="form-group"><div class="col-sm-offset-2 col-sm-10"><button type="submit" class="btn btn-success">Show</button><button type="cancel" class="btn btn-warning">Cancel</button></div></div></form></body></html>';
    response.write(bottomPage);
    response.end();


    delete fields.variable;
        global.concentrations = [];
        for (var key in fields) {
            global.concentrations.push(fields[key]);
        }
        console.log('global.concentrations = ',global.concentrations);
        console.log('fields = ',fields);
    });    
};

function result(response, request) {
    var form = new formidable.IncomingForm();
    form.parse(request, function(error, fields, files) {
    console.log('fields == ', fields);
    console.log();
    response.writeHead(200, {"Content-Type": "text/html"});
    var topPage = '';
    response.write(topPage);
    console.log('global.global.concentrations == ', global.global.concentrations);
    console.log('global.workBook.list1 == ', global.workBook.list1);

    //формирование матрицы для подсчета определителя
    var G = [];
    var n = global.workBook.list1[global.concentrations[0]].length;
    for (var i = 0; i < global.concentrations.length; i++) {
      G.push([]);
        for (var j = 0; j < global.concentrations.length; j++) {
          var result = 0;
          for (var k = 0; k < global.workBook.list1[global.concentrations[i]].length; k++) {
            result += global.workBook.list1[global.concentrations[i]][k]*global.workBook.list1[global.concentrations[j]][k];
          }
            G[i][j] = result/n;
        };
    };
    console.log(G);


    //определяем по чем нам показывать данные
    var currentGroup = fields.group;
    //удалить название переменной, оставить только парметры анализа
    delete fields.group;


    //вычисление коеффициентов
    var det = Determinant(G);
    //это цикл по всем видам групп людей (к-тая группа)
    // global.concentrations
    // global.workBook.list1
    // global.workBook.list1[global.concentrations[1]]
    // global.workBook.list1[global.concentrations[2]]
    global.koeffs = {};
    for (var k = 1; k <= global.concentrations.length; k++) {
        global.koeffs[global.concentrations[k-1]] = [];
        //этот цикл по всем показателям в к-той группе j-тое наблюдение
        for (var j = 0; j < global.workBook.list1[global.concentrations[k-1]].length; j++) {
            //для всех данных текущей группы
            var koef = 1/det;

            // в этом цикле идет подсчет суммы
            var sum = 0;
            for (var m = 1; m <= global.concentrations.length; m++) {
                sum += Math.pow(-1, m + k) * Minor(G, k, m) * global.workBook.list1[global.concentrations[m-1]][j];
            };
            koef *= sum;
        global.koeffs[global.concentrations[k-1]].push(koef);
        }
    }
    console.log('koeffs = ', koeffs);
    //Функция для вычисления определителя матрицы A
    function Determinant(A){  
    var n = A.length, subA = [], detA = 0;
    if (n==1) return A[0][0];
    for (var i=0; i<n; i++)
        { for (var h=0; h<n-1; h++) subA[h]=[];
          for (var a=1; a<n; a++)
              { for (var b=0; b<n; b++)
                    { if (b<i)       subA[a-1][ b ] = A[ a ][ b ];
                      else if (b>i)  subA[a-1][b-1] = A[ a ][ b ];
                    }
              }
          var sign = (i%2==0) ? 1 : -1;
          detA += sign * A[0][i] * Determinant(subA);
        }
    return detA;
    }

    //Функция для вычисления дополняющего минор
    function Minor(matrix,stol,stro){
      var result = [];
      var k = 0;
      var l = 0;
      for(var i = 0; i  <  matrix.length; i++){
            if (i==stol - 1) {
                k=1;
                continue
            };
            result[i-k] = [];

            for(var j =0;j < matrix[i].length;j++){
                if (j==stro - 1) {
                    l=1;
                    continue
                };
                result[i-k][j-l] = matrix[i][j];
            }

            l=0;
        }
        result.length
      return Determinant(result);
    }






    for (var key in fields) {
        switch (fields[key]){
            case 'numbers':
                response.write('<div class = "head" style="font-size:20px">Numbers information</div>');
                var numbersData = 'numbersData';
                

                response.write(numbersData);
            break;



        }
        
    };
    // for (var key in fields) {
    //     if (key == 'variable') {continue};
    //     response.write('<option>');
    //     response.write(fields[key]);
    //     response.write('</option>');
    // };
    var bottomPage = '';
    response.write(bottomPage);
    response.end();

    });    
};

exports.start = start;
exports.upload = upload;
exports.choose = choose;
exports.result = result;