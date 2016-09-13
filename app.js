var express = require('express');
var app = express();
var http = require('http');
var lwip = require("lwip");
var fs = require("pn/fs"); // https://www.npmjs.com/package/pn
var svg2png = require("svg2png");

app.use(express.static('public'));

app.get('/', function(req, res) {
    req.query.layer = req.query.layer || [];
    req.query.tint = req.query.tint || [];
    req.query.size = req.query.size || [];
    var layers = req.query.layer.push ? req.query.layer : [req.query.layer];
    var tints = req.query.tint.push ? req.query.tint : [req.query.tint];
    var sizes = req.query.size.push ? req.query.size : [req.query.size];
    var scale = req.query.scale ? parseInt(req.query.scale) : 1;

    
    var renderResult = function(masterImage, layerIndex) {

        var size = sizes[layerIndex] ? parseInt(sizes[layerIndex]) : sizes[0];
        var scaledSize = Math.round(size * scale);

        function toBuffer() {
            masterImage.toBuffer('png', function(err, buffer) {
                if (err) {
                    res.send(err);
                }

                res.writeHead(200, {
                    'Content-Type': 'image/png'
                });
                res.end(buffer, 'binary');
            });
            return;
        }

        if (layerIndex > layers.length - 1) {
            if (size) {
                masterImage.resize(scaledSize, scaledSize, 'lanczos', function(err, image) {
                    if (err) return res.send(err);
                    masterImage = image;
                    toBuffer();
                });
            }
            else {
                toBuffer();
            }
            return;
        }

        var uri = layers[layerIndex];

        http.get(uri, function(response) {

            var imagedata = ''
            response.setEncoding('binary')

            response.on('data', function(chunk) {
                imagedata += chunk
            })

            response.on('end', function() {
                //if (err) {
                //  res.send(err);
                //}
                
                function processBuffer(buffer) {
                    lwip.open(buffer, 'png', function(err, image) {
                        if (err) {
                            res.send(err);
                        }

                        if (tints && tints[layerIndex]) {
                            var tint = tints[layerIndex];
                            (function setTint(x, y) {
                                var color = image.getPixel(x, y);
                                var tintColor = hexToRgb(tint)
                                tintColor.a = color.a;
                                image.setPixel(x, y, tintColor, function() {
                                    if (++x < image.width())
                                        setTint(x, y);
                                    else if (++y < image.height())
                                        setTint(0, y);
                                    else collapseImage();
                                });

                            })(0, 0);
                        }
                        else {
                            collapseImage();
                        }

                        function collapseImage() {
                            if (masterImage) {
                                var x = (masterImage.width() - image.width()) * 0.5;
                                var y = (masterImage.height() - image.height()) * 0.5;
                                masterImage.paste(x, y, image, function(err, image) {
                                    if (err) {
                                        res.send(err);
                                    }
                                    masterImage = image;

                                    renderResult(masterImage, ++layerIndex);

                                });
                            }
                            else {
                                masterImage = image;

                                renderResult(masterImage, ++layerIndex);

                            }
                        }
                    });
                } 
                
                if (uri.indexOf('.svg') == uri.length - 4) {
                    svg2png(new Buffer(imagedata), { width: scaledSize, height: scaledSize })
                        //.then(imageBuffer => fs.writeFile("dest.png", imageBuffer))
                        .then(imageBuffer => processBuffer(imageBuffer))
                        .catch(e => console.error(e));
                } else {
                    processBuffer(new Buffer(imagedata, 'binary'));
                }

            });
        });
    }

    renderResult(null, 0);

});

var host = process.env.IP || 'localhost';
var port = process.env.PORT || 3000;

var server = app.listen(port, function() {
    console.log('Example app listening at http://%s:%s', host, port);
});




function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}