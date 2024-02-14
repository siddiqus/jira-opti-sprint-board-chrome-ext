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
    return extractedName ? extractedName.split(',').map((s) => s.trim()) : [];
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
        extraFields: issue.extraFields || [],
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

  function getAllIssueCardsByIssueKey() {
    const cards = [...document.getElementsByClassName('ghx-issue')];

    const htmlCardMap = cards.reduce((obj, card) => {
      const id = card.getAttribute('id');
      return {
        ...obj,
        [id]: card,
      };
    }, {});

    return htmlCardMap;
  }

  function highlightInProgressIssuesHoursElapsed(issueData) {
    const htmlCardMap = getAllIssueCardsByIssueKey();

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
      const newObj = {
        ...obj,
      };
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

  function appendHtmlStringToHeader(newElementSelector, html) {
    let htmlElem;
    if (typeof html === 'string') {
      htmlElem = Utils.getHtmlFromString(html);
    } else {
      htmlElem = html;
    }

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

  function populateEpicCompletionData(epicCompletionData) {
    if (!epicCompletionData.length) {
      return;
    }

    const headerElem = document.querySelector(SPRINT_HEADER_ID);

    if (!headerElem) {
      return;
    }

    const getHtml = (epic) => {
      const elem = Utils.getHtmlFromString(`<span
        class="aui-label ghx-jira-plugin-epic-selector"
        style="cursor: pointer; padding: 5px; font-weight: 600; font-size: ${HEADER_STATS_FONT_SIZE}">
          ${epic.epicName} (${epic.doneCount}/${epic.totalCount})
      </span>`);

      function toggleEpicFilter(e, epicName) {
        const isSelected = e.style.border.includes('blue');

        if (!isSelected) {
          sprintIssueFilters.byEpic.set(epicName);
          e.style.border = '1px solid blue';
        } else {
          sprintIssueFilters.byEpic.reset();
        }
      }

      elem.addEventListener('click', (e) => {
        toggleEpicFilter(e.target, epic.epicName);
      });

      elem.addEventListener('mouseover', () => {
        elem.style.backgroundColor = '#e7e7e7';
      });

      elem.addEventListener('mouseout', () => {
        elem.style.backgroundColor = '';
      });

      return elem;
    };

    const elementId = 'ghx-header-epic-counts';

    const container = Utils.getHtmlFromString(`<div
        id="${elementId}"
        style="padding-top:5px;"
    >
        <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${HEADER_STATS_FONT_SIZE}">
            EPICS:
        </span>
    </div>`);

    let existingElem = headerElem.querySelector(`#${elementId}`);
    if (existingElem) {
      existingElem.remove();
    }

    Utils.insertAfter(document.getElementById('ghx-column-headers'), container);

    epicCompletionData.sort((a, b) => {
      if (a.name === 'N/A') {
        return -1;
      }
      if (b.name === 'N/A') {
        return 1;
      }
      return b.totalCount - a.totalCount;
    });

    existingElem = document.getElementById(elementId);
    for (const epic of epicCompletionData) {
      const epicHtml = getHtml(epic);
      existingElem.appendChild(epicHtml);
    }
  }

  function populateAssigneeData(assignedTasksData) {
    const headerElem = document.querySelector(SPRINT_HEADER_ID);
    if (!headerElem) {
      return;
    }

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

    const getHtml = (assigneeName, assigneeTasks) => {
      const elem = Utils.getHtmlFromString(`<span 
        class="aui-label ghx-jira-plugin-assignee-selector"
        style="cursor: pointer; padding: 5px; font-weight: 600; color: gray; font-size: ${HEADER_STATS_FONT_SIZE}">
          ${assigneeName}: ${assigneeTasks}
        </span>`);

      function toggleAssigneeFilter(e, assignee) {
        const isSelected = e.style.border.includes('blue');

        if (!isSelected) {
          sprintIssueFilters.byAssignee.set(assignee);
          e.style.border = '1px solid blue';
        } else {
          sprintIssueFilters.byAssignee.reset();
        }
      }

      elem.addEventListener('click', (e) => {
        toggleAssigneeFilter(e.target, assigneeName);
      });

      elem.addEventListener('mouseover', () => {
        elem.style.backgroundColor = '#e7e7e7';
      });

      elem.addEventListener('mouseout', () => {
        elem.style.backgroundColor = '';
      });

      return elem;
    };

    const elementId = 'ghx-header-assignee-task-counts';

    const container = Utils.getHtmlFromString(`<div id="${elementId}">
      <span class="aui-label ghx-sprint-board-assignee-selector" style="padding: 5px; font-weight: 600; font-size: ${HEADER_STATS_FONT_SIZE}">
        ASSIGNED:
      </span>
    </div>`);

    let existingElem = headerElem.querySelector(`#${elementId}`);
    if (existingElem) {
      existingElem.remove();
    }

    // insert after epics
    Utils.insertAfter(document.getElementById('ghx-header-epic-counts'), container);

    dataArray.sort((a, b) => {
      if (a.name === 'Unassigned') {
        return -1;
      }
      if (b.name === 'Unassigned') {
        return 1;
      }
      return b.count - a.count;
    });

    existingElem = document.getElementById(elementId);

    for (const assignee of dataArray) {
      const epicHtml = getHtml(assignee.name, assignee.count);
      existingElem.appendChild(epicHtml);
    }
  }

  function isStatusInReview(status) {
    return (
      (status.toLowerCase().includes('peer') || status.toLowerCase().includes('code')) &&
      status.toLowerCase().includes('review')
    );
  }

  function isStatusInProgressOrReview(status) {
    return isStatusInReview(status) || status.toLowerCase().includes('in progress');
  }

  function getFreeReviewersSet(issueData) {
    const allPeople = new Set(issueData.map((i) => i.assignee));
    const inReview = issueData.filter((i) => isStatusInReview(i.status));

    const reviewersInReview = new Set(inReview.flatMap((i) => i.reviewers));
    const freeReviewers = Array.from(allPeople).filter((person) => !reviewersInReview.has(person));
    return new Set(freeReviewers);
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

    const issuesByAssignee = Utils.groupBy(issueData, 'assignee');
    Object.keys(issuesByAssignee).forEach((assignee) => {
      const issuesForAssignee = issuesByAssignee[assignee] || [];
      issuesByAssignee[assignee] = issuesForAssignee.filter((i) =>
        isStatusInProgressOrReview(i.status),
      );
    });

    // ignore todo tickets under Anis bhai's name.
    const allPeople = Array.from(new Set(issueData.map((i) => i.assignee))).filter(
      (p) => !['Anisul Hoque', 'Ahmed Anough', 'Unassigned'].includes(p), // exclude POs and unassigned
    );

    const freeReviewersSet = getFreeReviewersSet(issueData, reviewersMap);

    const dataArray = allPeople.reduce((arr, name) => {
      const issuesForAssignee = issuesByAssignee[name] || [];
      const isFree = freeReviewersSet.has(name) && issuesForAssignee.length < 3; // max 3 allowed in progress for review
      const count = reviewersMap[name] ? reviewersMap[name].length : 0;

      const newArr = [
        ...arr,
        {
          name,
          count,
          isFree,
        },
      ];
      return newArr;
    }, []);

    dataArray.sort((a, b) => b.count - a.count);

    return dataArray;
  }

  function populateReviewerData(issueData) {
    const dataArray = getReviewerData(issueData);

    const getHtml = (
      reviewer,
    ) => `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${HEADER_STATS_FONT_SIZE}">
      ${reviewer.name}: ${reviewer.count || ''} ${reviewer.isFree ? '<span style="color:#555">(free)</span>' : ''}
    </span>`;
    const elementId = 'ghx-header-reviewer-task-counts';
    let htmlString = `<div id="${elementId}"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${HEADER_STATS_FONT_SIZE}">REVIEWS:</span>`;

    dataArray.forEach((reviewer) => {
      const epicHtml = getHtml(reviewer);
      htmlString += epicHtml;
    });
    htmlString += '</div>';

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  function showStatusColumnCounts(issueData) {
    const statusCountMap = issueData.reduce((map, issue) => {
      const newMap = {
        ...map,
      };
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
    const parent = document.querySelector('.ghx-sprint-meta');

    const doneCount = issueData.filter((i) => i.isDone).length;
    const totalCount = issueData.length;

    const percentage = totalCount > 0 ? Math.round((100 * doneCount) / totalCount) : 0;

    const progressBarId = 'ghx-sprint-progress-bar-container';

    const progressBarBorderRadius = percentage < 94 ? '2em 2px 2px 2em' : '2em';
    const progressBarHtmlString = `<div id="${progressBarId}" style="float:left; border-radius: 2em; border: 1px solid gray; margin-left: 20px; margin-right: 20px; width: 200px; height: 26px; position: relative; display: inline-block;">
          <div id="ghx-progressBar" style="height: 26px; background: #3ea9ff;border-radius: ${progressBarBorderRadius};width: ${percentage}%;"></div>
          <span style="position: absolute; font-size: 12px; color: black; left: 25%; top: 18%; font-weight: 500; width: 100px; text-align: center;">
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

  function removeReviewerPairData() {
    const elem = document.getElementById('ghx-header-reviewer-pairs-counts');
    if (elem) {
      elem.remove();
    }
  }

  function populateReviewerPairData(issuesData) {
    if (!issuesData.length) {
      return;
    }

    const pairCounts = getReviewerPairs(issuesData);

    const dataArray = Object.keys(pairCounts)
      .reduce((obj, pair) => {
        const [p1, p2] = pair.split('-').map((p) => p.split(' ').shift());
        // first names only
        const count = pairCounts[pair];
        const newPair = {
          p1,
          p2,
          count,
        };
        return [...obj, newPair];
      }, [])
      .filter((p) => p.count > 2);

    dataArray.sort((a, b) => b.count - a.count);

    const getHtml = (
      pairData,
    ) => `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${HEADER_STATS_FONT_SIZE}">
      ${pairData.p1} + ${pairData.p2} (${pairData.count})
    </span>`;

    const elementId = 'ghx-header-reviewer-pairs-counts';
    let htmlString = `<div id="${elementId}">
      <span
        title="High Frequency Review Pairs, for people pairing for reviews more than twice"
        class="aui-label"
        style="padding: 5px; font-weight: 600; font-size: ${HEADER_STATS_FONT_SIZE}">
        HFRP:
      </span>
  `;

    dataArray.forEach((pairData) => {
      const epicHtml = getHtml(pairData);
      htmlString += epicHtml;
    });
    htmlString += '</div>';

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  async function renderSearchHtmlElement() {
    const existingElem = document.getElementById('ghx-board-search-container');
    if (existingElem) {
      return;
    }

    const html = `<div
  id="ghx-board-search-container"
  style="position: absolute;top: 0;right: 20px;width: 196px;border: 1px solid lightgray;border-radius: 3px;padding: 8px 10px;"
>
  <input id="ghx-board-search-input" placeholder="Search here" spellcheck="false" style="border: none; border-radius: 3px; color: #666; width: 170px;"></input>
  <span id="ghx-board-search-icon" class="js-search-trigger ghx-iconfont aui-icon aui-icon-small aui-iconfont-search-small" style="position: absolute; right: 10px; top: 24%; color: #666; background: white;">
  </span>
</div>`;

    const element = Utils.getHtmlFromString(html);
    const parent = document.getElementById('ghx-operations');
    parent.appendChild(element);

    addSprintSearchBarBehavior();
  }

  function getReviewerSuggestions(issueData) {
    const inCodeReviewWithoutReviewer = issueData.filter(
      (i) =>
        (i.status.toLowerCase().includes('code review') ||
          i.status.toLowerCase().includes('peer review')) &&
        !(i.reviewers || []).length,
    );

    const peopleArray = getReviewerData(issueData); // all people

    const availableReviewers = peopleArray.sort((a, b) => a.count - b.count);

    // Iterate through issues and assign potential reviewers
    const updatedIssueArray = inCodeReviewWithoutReviewer.map((issue, index) => {
      const wrappedIndex = index % availableReviewers.length;
      const nextIndex = (wrappedIndex + 1) % availableReviewers.length;

      const suggestedReviewers = [];
      if (availableReviewers[wrappedIndex]) {
        suggestedReviewers.push(availableReviewers[wrappedIndex].name.split(' ').shift());
      }

      if (availableReviewers[nextIndex]) {
        suggestedReviewers.push(availableReviewers[nextIndex].name.split(' ').shift());
      }

      if (suggestedReviewers.length) {
        return { ...issue, potentialReviewer: suggestedReviewers.join(' | ') };
      }

      return issue;
    });

    return updatedIssueArray;
  }

  function renderReviewerSuggestions(issueData) {
    const suggestions = getReviewerSuggestions(issueData);

    const cardsByIssueKey = getAllIssueCardsByIssueKey();

    for (const suggestion of suggestions) {
      const { issueKey, extraFields, potentialReviewer } = suggestion;
      const card = cardsByIssueKey[issueKey];
      if (!card) {
        continue;
      }

      const extraFieldsIndex = extraFields.findIndex((f) =>
        f.label.toLowerCase().includes('code reviewer'),
      );

      const theReviewerFieldElem = card.querySelectorAll('.ghx-extra-field-row')[extraFieldsIndex];
      // add suggestion if not there
      if (theReviewerFieldElem && theReviewerFieldElem.innerText === 'None') {
        const innerFieldContent = theReviewerFieldElem.querySelector('.ghx-extra-field-content');
        innerFieldContent.innerText = `Suggested: ${potentialReviewer}`;
      }
    }
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

    if (!issueData.length) {
      return;
    }

    showStatusColumnCounts(issueData);

    renderProgressBar(issueData);

    if (await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)) {
      highlightInProgressIssuesHoursElapsed(getInProgressIssues(issueData));
    } else {
      [...document.getElementsByClassName(TIME_ELAPSED_CLASS_NAME)].forEach((q) => q.remove());
    }

    populateEpicCompletionData(getEpicCompletionData(issueData));
    populateAssigneeData(Utils.groupBy(issueData, 'assignee'));
    populateReviewerData(issueData);
    if (await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED)) {
      populateReviewerPairData(issueData);
    } else {
      removeReviewerPairData();
    }
    renderSearchHtmlElement();

    initSprintFilters();

    filterSprintIssuesV2();

    renderReviewerSuggestions(issueData);
  }

  await run();
}

enhanceSprintBoard();
