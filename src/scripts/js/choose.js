$('label').click(function(e) {
                $('body').append('<div></div>');
                $('body').find('form+div').attr('class', 'popup');
                var popup = $('.popup');
                popup.css({
                	width: '300',
                	position: 'absolute',
                	top: '50%',
                	left: '50%',
                	marginTop:'100',
                	marginLeft:'-300',
                	border:'1px solid black'
                }); 
                popup.html='hellow world!';
            });
