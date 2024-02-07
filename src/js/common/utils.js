// eslint-disable-next-line
const Utils = {
  delay: async (ms) =>
    // eslint-disable-next-line
    new Promise((res) => setTimeout(res, ms)),
  groupBy: (collection, iteratee) =>
    collection.reduce((result, item) => {
      const key = typeof iteratee === 'function' ? iteratee(item) : item[iteratee];

      const newObj = { ...result };

      if (!newObj[key]) {
        newObj[key] = [];
      }

      newObj[key].push(item);
      return newObj;
    }, {}),

  getFromUrl: async (apiUrl) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.withCredentials = true;
      // Include credentials (cookies) in the request

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (error) {
              reject(new Error('Error parsing JSON response'));
            }
          } else {
            reject(new Error(`HTTP error! Status: ${xhr.status}`));
          }
        }
      };

      xhr.open('GET', apiUrl, true);
      xhr.send();
    }),

  getHtmlFromString: (htmlString) => {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlString;
    return tempContainer.firstChild;
  },
};
