'use strict';

const fs = require('fs');
const request = require('request-promise-native');

const Minio = require('minio');

const minioSecret = JSON.parse(fs.readFileSync('/var/openfaas/secrets/minio_secrets.json', 'utf8').trim());

const minioEndPoint = process.env.MINIO_ENDPOINT;
const minioPort = parseInt(process.env.MINIO_PORT) || 9000;

const predictEndPoint = process.env.PREDICT_ENDPOINT;

const mc = new Minio.Client({
    endPoint: minioEndPoint,
    port: minioPort,
    useSSL: false,
    accessKey: minioSecret.access_key,
    secretKey: minioSecret.secret_key
});

const b64 = function (dataStream) {
    return new Promise(function (resolve, reject) {
        const buffers = [];

        dataStream.on('data', function (chunk) {
            buffers.push(chunk);
        });

        dataStream.on('error', function (error) {
            reject(error);
        });

        dataStream.on('end', function () {
            const buffer = Buffer.concat(buffers);
            resolve(buffer.toString('base64'));
        });
    });
};

module.exports = (context, callback) => {
    const minioContext = JSON.parse(context);
    console.log(minioContext.Records[0]);

    const bname = minioContext.Records[0].s3.bucket.name;
    const oname = minioContext.Records[0].s3.object.key;

    mc.getObject(bname, oname,
        (err, dataStream) => {
            if (err) {
                callback(err);
            }

            b64(dataStream)
                .then(image => {
                    const requestData = { image };

                    return request.post({
                        url: predictEndPoint,
                        json: requestData
                    });
                }).then(({ cats, dogs }) => {
                    const bucketDest = cats > dogs ? 'images-cats' : 'images-dogs';

                    mc.copyObject(bucketDest, oname, `${bname}/${oname}`, null, function (errorCopy) {
                        if (errorCopy) {
                            callback(errorCopy);
                        } else {
                            callback(null, {
                                'message': 'Image classification successfully',
                                cats,
                                dogs
                            });
                        }
                    });
                }).catch((error) => {
                    callback(error);
                });
        });
};
