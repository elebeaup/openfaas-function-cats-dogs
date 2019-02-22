from flask import jsonify
import json

import PIL
from io import BytesIO
import base64

from tensorflow.python.keras import backend as K
from tensorflow.python.keras.models import load_model
from tensorflow.python.keras.applications.resnet50 import preprocess_input, decode_predictions
from tensorflow.python.keras.preprocessing import image

import tensorflow as tf
import numpy as np

graph = tf.get_default_graph()
model = None

def handle(req):
    global model
    """handle a request to the function
    Args:
        req (str): request body
    """

    if model is None:
        # load the trained model
        # https://github.com/jkjung-avt/keras-cats-dogs-tutorial
        model = load_model('function/model/model-resnet50-final.h5', compile=False)

    # Deserialize req and retrieve 'image' value from JSON
    image_data = json.loads(req)['image']

    # Load a base64 encoded image 
    img = (PIL.Image.open(BytesIO(base64.b64decode(image_data)))
                    .resize((224, 224)))
    
    # Converts a PIL Image instance to a Numpy array.
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)

    with graph.as_default():
        # Generates output predictions for the input data 'x'
        preds = model.predict(x)[0]

        ret = {
            "cats": preds[0].item(),
            "dogs": preds[1].item()
        }

        return jsonify(ret)