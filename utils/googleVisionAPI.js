const axios = require("axios");

const getTextHelper = async (API_KEY, data) => {
    try {
        const response = await axios({
            method: 'post',
            url: `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
            data: data,
            headers: {
                ['Content-Type']: "application/json; charset=utf-8"
            }
        });
        return response;
    } catch (e) {
        return e;
    }
}

const getText = async (API_KEY, image, maxResults) => {
    try {
        const data = {
            requests: [
                {
                    image: {
                        content: image
                    },
                    features: [
                        {
                            type: "TEXT_DETECTION",
                            maxResults: maxResults,
                            model: "builtin/latest"
                        }
                    ]
                }
            ]
        };
        const texts = await getTextHelper(API_KEY, data);
        return texts;
    } catch (e) {
        console.error(e);
        return;
    }
}

module.exports = getText;