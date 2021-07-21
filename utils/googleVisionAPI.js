const axios = require('axios');

const getTextHelper = async (API_KEY, data) => {
  try {
    const response = await axios({
      method: 'post',
      url: `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
      data,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
    return response;
  } catch (e) {
    return e;
  }
};

const getText = async (API_KEY, image, maxResults) => {
  try {
    const data = {
      requests: [
        {
          image: {
            content: image,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults,
              model: 'builtin/latest',
            },
          ],
        },
      ],
    };
    const texts = await getTextHelper(API_KEY, data);
    return texts;
  } catch (e) {
    return e;
  }
};

module.exports = getText;
