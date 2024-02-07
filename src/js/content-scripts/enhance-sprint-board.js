// eslint-disable-next-line
async function enhanceSprintBoard() {
  const baseUrl = 'https://jira.sso.episerver.net';
  const urlParams = new URLSearchParams(window.location.search);

  const rapidViewId = urlParams.get('rapidView');
  const view = urlParams.get('view') || '';

  if (window.location.href.indexOf(baseUrl) === -1 || view.includes('planning')) {
    return;
  }

  function getNamesFromHtml(htmlString) {
    const nameRegex = /<div[^>]*>([\s\S]*?)<\/div>/;
    const match = htmlString.match(nameRegex);
    const extractedName = match ? match[1].trim() : null;
    return extractedName ? extractedName.split(',').map((s) => s.trim()) : null;
  }

  function getReviewersFromHtml(theIssue) {
    if (!theIssue.extraFields) {
      return [];
    }

    const reviewers = theIssue.extraFields.find((f) => f.label === 'Code Reviewers');

    if (!reviewers) {
      return [];
    }

    return getNamesFromHtml(reviewers.html);
  }

  function getStatusNameFromId(statusMap, id) {
    return statusMap[id].statusName;
  }

  function getEpicNameFromId(epicMap, id) {
    if (!id) {
      return '';
    }
    return epicMap[id].epicField.text;
  }

  function getMappedIssueData(boardData) {
    const { epics, statuses } = boardData.entityData;

    const { issues } = boardData.issuesData;

    // questions
    // how long has this in the current column? (in-progress, code review, product review)

    const mappedIssues = issues.map((issue) => {
      const issueKey = issue.key;
      const assignee = issue.assigneeName || 'Unassigned';
      const epicName = getEpicNameFromId(epics, issue.epicId);

      const storyPoints = +issue.estimateStatistic.statFieldValue.value;

      const reviewers = getReviewersFromHtml(issue);

      const status = getStatusNameFromId(statuses, issue.statusId);
      const isDone = issue.done || status === 'Done';

      const timeElapsedInStatusInHours = issue.timeInColumn
        ? Math.floor((Date.now() - issue.timeInColumn.enteredStatus) / 1000 / 60 / 60)
        : 0;

      return {
        issueKey,
        assignee,
        epicName,
        storyPoints,
        reviewers,
        isDone,
        status,
        timeElapsedInStatusInHours,
      };
    });

    return mappedIssues;
  }

  const getBoardUrl = (baseUrl, rapidViewId) =>
    `${baseUrl}/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=${rapidViewId}`;

  function getTimeElapsedHtmlElement(timeInHours) {
    if (!timeInHours) {
      return null;
    }
    let color;
    if (timeInHours < 24) {
      color = 'gray';
    } else if (timeInHours < 48) {
      color = 'coral';
    } else if (timeInHours < 72) {
      color = 'maroon';
    } else {
      color = 'red';
    }

    const htmlString = `<div class='${TIME_ELAPSED_CLASS_NAME} aui-label' style="border-radius: 2em; color:${color};float: right;margin-left: 10px;margin-right: auto;"><b color="red"><span class="aui-icon aui-icon-small aui-iconfont-time"></span> ${timeInHours}h</b></div>`;

    return Utils.getHtmlFromString(htmlString);
  }

  function getInProgressIssues(issueData) {
    return issueData.filter((f) => !['To Do'].includes(f.status) && !f.isDone);
  }

  function highlightInProgressIssuesHoursElapsed(issueData) {
    const cards = [...document.getElementsByClassName('ghx-issue')];

    const htmlCardMap = cards.reduce((obj, card) => {
      const id = card.getAttribute('id');
      return { ...obj, [id]: card };
    }, {});

    for (const issue of issueData) {
      const htmlCard = htmlCardMap[issue.issueKey];
      if (!htmlCard) {
        continue;
      }

      const parentClass = 'ghx-card-footer';
      const endDivClass = 'ghx-days';

      const parentElem = htmlCard.querySelector(`.${parentClass}`);
      const endElem = htmlCard.querySelector(`.${endDivClass}`);

      const newHtmlElem = getTimeElapsedHtmlElement(issue.timeElapsedInStatusInHours);

      if (!newHtmlElem) {
        continue;
      }

      const existingElem = htmlCard.querySelector(`.${TIME_ELAPSED_CLASS_NAME}`);
      if (!existingElem) {
        parentElem.insertBefore(newHtmlElem, endElem);
      } else {
        existingElem.innerHTML = newHtmlElem.innerHTML;
      }
    }
  }

  function getEpicCompletionData(issueData) {
    const epicMap = issueData.reduce((obj, issue) => {
      const epicName = issue.epicName || 'N/A';
      const newObj = { ...obj };
      if (newObj[epicName]) {
        newObj[epicName].push(issue);
      } else {
        newObj[epicName] = [issue];
      }
      return newObj;
    }, {});

    const results = [];
    for (const epicName of Object.keys(epicMap)) {
      const issues = epicMap[epicName] || [];

      results.push({
        epicName,
        doneCount: issues.filter((f) => f.isDone).length,
        totalCount: issues.length,
      });
    }

    return results;
  }

  function appendHtmlStringToHeader(newElementSelector, htmlString) {
    const htmlElem = Utils.getHtmlFromString(htmlString);

    const headerElem = document.querySelector(SPRINT_HEADER_ID);

    if (!headerElem) {
      return;
    }

    const existingElem = headerElem.querySelector(newElementSelector);
    if (!existingElem) {
      headerElem.appendChild(htmlElem);
    } else {
      existingElem.innerHTML = htmlElem.innerHTML;
    }
  }

  const headerStatsFontSize = '11px';

  function populateEpicCompletionData(epicCompletionData) {
    if (!epicCompletionData.length) {
      return;
    }
    const getHtml = (epic) =>
      `<span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}"> ${epic.epicName} (${epic.doneCount}/${epic.totalCount}) </span>`;
    let htmlString = `<div id="ghx-header-epic-counts" style="padding-top:5px;"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">EPICS:</span> `;

    epicCompletionData.sort((a, b) => b.totalCount - a.totalCount);

    for (const epic of epicCompletionData) {
      const epicHtml = getHtml(epic);
      htmlString += epicHtml;
    }
    htmlString += '</div>';

    appendHtmlStringToHeader('#ghx-header-epic-counts', htmlString);
  }

  function populateAssigneeData(assignedTasksData) {
    const dataArray = Object.keys(assignedTasksData).reduce(
      (arr, d) => [
        ...arr,
        {
          name: d,
          count: assignedTasksData[d].length,
        },
      ],
      [],
    );

    if (!dataArray.length) {
      return;
    }

    dataArray.sort((a, b) => {
      if (a.name === 'Unassigned') {
        return -1;
      }
      if (b.name === 'Unassigned') {
        return 1;
      }
      return b.count - a.count;
    });

    const getHtml = (asigneeName, assigneeTasks) =>
      `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${headerStatsFontSize}"> ${asigneeName}: ${assigneeTasks} </span>`;
    const elementId = 'ghx-header-assignee-task-counts';
    let htmlString = `<div id="${elementId}"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">ASSIGNED:</span>`;

    for (const assignee of dataArray) {
      const epicHtml = getHtml(assignee.name, assignee.count);
      htmlString += epicHtml;
    }
    htmlString += '</div>';

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  function getReviewerData(issueData) {
    const reviewersMap = {};

    for (const issue of issueData) {
      if (!issue.reviewers) {
        continue;
      }
      for (const reviewer of issue.reviewers) {
        if (reviewersMap[reviewer]) {
          reviewersMap[reviewer].push(issue);
        } else {
          reviewersMap[reviewer] = [issue];
        }
      }
    }

    return reviewersMap;
  }

  function getFreeReviewersSet(issueData) {
    const allPeople = new Set(issueData.map((i) => i.assignee));
    const inReview = issueData.filter(
      (i) =>
        (i.status.toLowerCase().includes('peer') || i.status.toLowerCase().includes('code')) &&
        i.status.toLowerCase().includes('review'),
    );

    const reviewersInReview = new Set(inReview.flatMap((i) => i.reviewers));
    const freeReviewers = Array.from(allPeople).filter((person) => !reviewersInReview.has(person));
    return new Set(freeReviewers);
  }

  function populateReviewerData(issueData) {
    const reviewerData = getReviewerData(issueData);

    if (!Object.keys(reviewerData).length) {
      return;
    }

    const allPeople = Array.from(new Set(issueData.map((i) => i.assignee)));

    const freeReviewersSet = getFreeReviewersSet(issueData, reviewerData);

    const dataArray = allPeople.reduce(
      (arr, name) => [
        ...arr,
        {
          name,
          count: reviewerData[name] ? reviewerData[name].length : 0,
          isFree: freeReviewersSet.has(name),
        },
      ],
      [],
    );

    dataArray.sort((a, b) => b.count - a.count);

    const getHtml = (reviewer) => {
      return `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${headerStatsFontSize}">
        ${reviewer.name}: ${reviewer.count || ''} ${reviewer.isFree ? '<span style="color:#555">(free)</span>' : ''}
      </span>`;
    };
    const elementId = 'ghx-header-reviewer-task-counts';
    let htmlString = `<div id="${elementId}"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">REVIEWS:</span>`;

    dataArray.forEach((reviewer) => {
      const epicHtml = getHtml(reviewer);
      htmlString += epicHtml;
    });
    htmlString += '</div>';

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  function showStatusColumnCounts(issueData) {
    const statusCountMap = issueData.reduce((map, issue) => {
      const newMap = { ...map };
      const status = issue.status.toUpperCase();
      if (newMap[status]) {
        newMap[status] += 1;
      } else {
        newMap[status] = 1;
      }
      return newMap;
    }, {});

    function sanitizeProductReviewHeading(header) {
      // for team 7 board
      const upperCaseHeader = header.toUpperCase();
      return upperCaseHeader.includes('PRODUCT') && upperCaseHeader.includes('REVIEW')
        ? 'PRODUCT REVIEW'
        : upperCaseHeader;
    }

    const columnHeaders = [...document.querySelectorAll('.ghx-column-headers .ghx-column')];
    columnHeaders.forEach((headerElement) => {
      const headerTitleElem = headerElement.querySelector('.ghx-column-title');
      let columnStatus = headerTitleElem.innerText.trim().toUpperCase().split(' (')[0];

      columnStatus = sanitizeProductReviewHeading(columnStatus);
      const statusCount = statusCountMap[columnStatus];
      const newDisplayText = `${columnStatus} (${statusCount || 0})`;
      headerTitleElem.innerText = newDisplayText;
    });
  }

  function renderProgressBar(issueData) {
    if (!issueData.length) {
      return;
    }
    const parent = document.querySelector('.ghx-sprint-meta');

    const doneCount = issueData.filter((i) => i.isDone).length;
    const totalCount = issueData.length;

    const percentage = totalCount > 0 ? Math.round((100 * doneCount) / totalCount) : 0;

    const progressBarId = 'ghx-sprint-progress-bar-container';

    const progressBarHtmlString = `<div id="${progressBarId}" style="float:left; margin-left: 20px; margin-right: 20px; width: 200px; height: 30px; position: relative; display: inline-block;">
            <progress id="ghx-progressBar" value="${percentage}" max="100" style="width: 200px; height: 32px;"></progress>
            <span style="position: absolute; font-size: 10px; color: #666; left: 33%; top: 30%; font-weight: bold; width: 80px; text-align: center;">
                ${doneCount} / ${totalCount} points
            </span>
        </div>`;

    const progressBarHtml = Utils.getHtmlFromString(progressBarHtmlString);

    const existingElem = document.getElementById(progressBarId);
    if (existingElem) {
      existingElem.remove();
    }
    if (parent) {
      parent.insertBefore(progressBarHtml, parent.firstChild);
    }
  }

  function getReviewerPairs(issuesData) {
    const pairCounts = {};

    issuesData.forEach((issue) => {
      if (issue.assignee && issue.reviewers && issue.reviewers.length > 0) {
        issue.reviewers.forEach((reviewer) => {
          const pair = [issue.assignee, reviewer].sort().join('-');
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        });
      }
    });

    return pairCounts;
  }

  function populateReviewerPairData(issuesData) {
    if (!issuesData.length) {
      return;
    }

    const pairCounts = getReviewerPairs(issuesData);

    const dataArray = Object.keys(pairCounts).reduce((obj, pair) => {
      const [p1, p2] = pair.split('-').map((p) => p.split(' ').shift()); // first names only
      const count = pairCounts[pair];
      const newPair = {
        p1,
        p2,
        count,
      };
      return [...obj, newPair];
    }, []);

    dataArray.sort((a, b) => b.count - a.count);

    const getHtml = (
      pairData,
    ) => `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${headerStatsFontSize}">
        ${pairData.p1} + ${pairData.p2} (${pairData.count})
      </span>`;

    const elementId = 'ghx-header-reviewer-pairs-counts';
    let htmlString = `<div id="${elementId}">
      <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">REVIEW PAIRS:</span>
    `;

    dataArray.forEach((pairData) => {
      const epicHtml = getHtml(pairData);
      htmlString += epicHtml;
    });
    htmlString += '</div>';

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  async function run() {
    const boardUrl = getBoardUrl(baseUrl, rapidViewId);

    let boardData;
    try {
      boardData = await Utils.getFromUrl(boardUrl);
    } catch (error) {
      console.log('Failed fetching board data', error);
      return;
    }

    const issueData = getMappedIssueData(boardData);

    showStatusColumnCounts(issueData);

    renderProgressBar(issueData);

    if (await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)) {
      highlightInProgressIssuesHoursElapsed(getInProgressIssues(issueData));
    } else {
      [...document.getElementsByClassName(TIME_ELAPSED_CLASS_NAME)].forEach((q) => q.remove());
    }

    // for headers, these will be shown in the reverse order
    populateEpicCompletionData(getEpicCompletionData(issueData));
    populateAssigneeData(Utils.groupBy(issueData, 'assignee'));
    populateReviewerData(issueData);
    if (await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED)) {
      populateReviewerPairData(issueData);
    }
  }

  await run();
}
