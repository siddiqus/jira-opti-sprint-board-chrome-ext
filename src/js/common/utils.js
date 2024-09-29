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
    tempContainer.innerHTML = htmlString.trim();
    return tempContainer.firstChild;
  },

  insertAfter: (referenceNode, newNode) => {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  },

  toFixed: (number, decimals = 2) => {
    return +Number(number).toFixed(decimals);
  },
};

function clearSprintSearchBar() {
  const elem = document.getElementById('ghx-board-search-container');
  if (elem) {
    elem.remove();
  }
}

function removeSprintStatsBar() {
  const statsWrapperElem = document.getElementById(CUSTOM_SPRINT_STATS_WRAPPER_ID);
  if (statsWrapperElem) {
    statsWrapperElem.remove();
  }
}

function clearSprintEnhancements() {
  clearSprintSearchBar();
  removeSprintStatsBar();
}

function isSprintBoard() {
  const html = document.getElementById('ghx-work');
  if (!html) {
    return false;
  }
  return html.innerHTML !== '';
}

function isBacklog() {
  const html = document.getElementById('ghx-plan');
  if (!html) {
    return;
  }
  return html.innerHTML !== '';
}

function isReports() {
  const html = document.getElementById('ghx-report').innerHTML;
  return html !== '';
}

function getNormalizedStatus(statusString) {
  if ([STATUSES.CODE_REVIEW, STATUSES.PEER_REVIEW].includes(statusString.toLowerCase())) {
    return STATUSES.CODE_REVIEW;
  }

  return statusString.toLowerCase();
}

function getStatusColor(statusString) {
  return colors.byStatus[getNormalizedStatus(statusString)];
}
