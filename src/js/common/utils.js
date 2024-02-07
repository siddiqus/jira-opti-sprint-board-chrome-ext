const Utils = {
  delay: async (ms) => {
    return new Promise((res) => setTimeout(res, ms));
  },
  groupBy: (collection, iteratee) => {
    return collection.reduce((result, item) => {
      const key =
        typeof iteratee === "function" ? iteratee(item) : item[iteratee];

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(item);
      return result;
    }, {});
  },
  getFromUrl: async (apiUrl) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.withCredentials = true;
      // Include credentials (cookies) in the request

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (error) {
              reject(new Error("Error parsing JSON response"));
            }
          } else {
            reject(new Error(`HTTP error! Status: ${xhr.status}`));
          }
        }
      };

      xhr.open("GET", apiUrl, true);
      xhr.send();
    });
  },
  getHtmlFromString: (htmlString) => {
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlString;
    return tempContainer.firstChild;
  },
};
