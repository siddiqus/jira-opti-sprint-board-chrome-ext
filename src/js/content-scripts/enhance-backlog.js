// eslint-disable-next-line
async function enhanceBacklog() {
  const issuesLists = [...document.querySelectorAll('.ghx-backlog-container')];

  if (!issuesLists.length) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);

  const view = urlParams.get('view') || '';
  if (!view.includes('planning')) {
    return;
  }

  function clearSprintSearchBar() {
    const elem = document.getElementById('ghx-board-search-container');
    if (elem) {
      elem.remove();
    }
  }

  function getTotalPointsHtmlElement(elementId, points) {
    const str = `<div id="${elementId}" style="
  position: absolute;
  right: 0;
  padding-right: 25px;
  padding-bottom: 12px;
  padding-top: 30px;
  ">(Total Points: ${points})</div>`;

    return Utils.getHtmlFromString(str);
  }

  function clearAllTotalCounts() {
    const elements = [...document.querySelectorAll('[id$="_totalPointsElement"]')];
    elements.forEach((e) => {
      e.remove();
    });
  }

  function refreshPointCount(element) {
    clearAllTotalCounts();

    const backlogId = element.querySelector('.ghx-name').innerText;

    const totalPointsElementId = `${backlogId}_totalPointsElement`.replace(/\s/g, '_');

    const selectedIssues = [...element.querySelectorAll('.js-issue.ghx-selected')];

    const totalPoints = selectedIssues.reduce((sum, issue) => {
      const countElem = issue.querySelector('.ghx-estimate .ghx-statistic-badge');
      const count = +countElem.innerText;
      return sum + count;
    }, 0);

    const totalPointsElem = getTotalPointsHtmlElement(totalPointsElementId, totalPoints);

    const existingElem = document.getElementById(totalPointsElementId);

    if (existingElem) {
      existingElem.innerText = totalPointsElem.innerText;
    } else {
      element.querySelector('.ghx-sprint-info').appendChild(totalPointsElem);
    }
  }

  issuesLists.forEach((issueList) => {
    issueList.addEventListener('click', async () => {
      await Utils.delay(100);
      // to give time for the selected class to be appended
      try {
        refreshPointCount(this);
      } catch (error) {
        console.error(error);
      }
    });
  });

  window.ENHANCE_BACKLOG_LISTENERS_IS_ACTIVE = 1;

  clearSprintSearchBar();
}
