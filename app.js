var express = require('express');
var app = express();
var http = require('http');
var lwip = require("lwip");

app.get('/', function(req, res) {
    req.query.layer = req.query.layer || [];
    req.query.tint = req.query.tint || [];
    var layers = req.query.layer.push ? req.query.layer : [req.query.layer];
    var tints = req.query.tint.push ? req.query.tint : [req.query.tint];
    var size = req.query.size;

    var renderResult = function(masterImage, layerIndex) {
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
                masterImage.resize(parseInt(size), parseInt(size), 'lanczos', function(err, image) {
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
                lwip.open(new Buffer(imagedata, 'binary'), 'png', function(err, image) {
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
            });
        });
    }

    renderResult(null, 0);

});

var server = app.listen(process.env.PORT, function() {
    var host = process.env.IP;
    var port = process.env.PORT;


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