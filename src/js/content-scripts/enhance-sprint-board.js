// eslint-disable-next-line
var visiblePopups = {
  progressBar: false,
  statsButton: false,
};
var localHashCache;

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
    const { epics, statuses, types: typeIdMap } = boardData.entityData;

    const { issues } = boardData.issuesData;

    const mappedIssues = [];
    for (const issue of issues) {
      const type = typeIdMap[issue.typeId].typeName;

      if (type === 'Epic') {
        continue;
      }

      const issueKey = issue.key;
      const assignee = issue.assigneeName || 'Unassigned';
      const epicName = getEpicNameFromId(epics, issue.epicId);

      const storyPoints = issue.estimateStatistic
        ? +issue.estimateStatistic.statFieldValue.value
        : 0;

      const reviewers = getReviewersFromHtml(issue);

      const status = getStatusNameFromId(statuses, issue.statusId);
      const isDone = issue.done || status === 'Done';

      const timeElapsedInStatusInHours = Math.max(
        0,
        issue.timeInColumn
          ? Math.floor((Date.now() - issue.timeInColumn.enteredStatus) / 1000 / 60 / 60)
          : 0,
      );

      mappedIssues.push({
        issueKey,
        assignee,
        epicName,
        storyPoints,
        reviewers,
        isDone,
        status,
        timeElapsedInStatusInHours,
        extraFields: issue.extraFields || [],
        type,
      });
    }

    return mappedIssues;
  }

  const getBoardUrl = (baseUrl, rapidViewId) =>
    `${baseUrl}/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=${rapidViewId}`;

  function getEffectiveHoursWithoutWeekend(timeInHours, currentDate = new Date()) {
    const MS_IN_HOURS = 60 * 60 * 1000;
    const WEEKEND_DAYS = [5, 6]; // friday saturday

    if (timeInHours < 24) {
      return timeInHours;
    }

    const startTime = new Date(currentDate.getTime() - timeInHours * MS_IN_HOURS);

    const currentTime = new Date(currentDate);

    let effectiveHours = timeInHours;

    while (true) {
      const currentDay = currentTime.getDay();
      if (WEEKEND_DAYS.includes(currentDay) && currentDay !== startTime.getDay()) {
        effectiveHours -= 24;
      }

      if (WEEKEND_DAYS.includes(currentDay) && currentDay === startTime.getDay()) {
        effectiveHours -= 24 - startTime.getHours();
      }

      if (currentDay === startTime.getDay()) {
        break;
      }
      currentTime.setDate(currentTime.getDate() - 1);
    }

    return Math.max(effectiveHours, 0);
  }

  function getTimeElapsedHtmlElement(timeInHours) {
    if (!timeInHours) {
      return null;
    }

    const effectiveHours = getEffectiveHoursWithoutWeekend(timeInHours);

    let color;
    if (effectiveHours < 24) {
      color = 'gray';
    } else if (effectiveHours < 48) {
      color = 'coral';
    } else if (effectiveHours < 72) {
      color = 'maroon';
    } else {
      color = 'red';
    }

    const htmlString = `<div class='${TIME_ELAPSED_CLASS_NAME} aui-label' style="border-radius: 2em; color:${color};float: right;margin-left: 10px;margin-right: auto;"><b color="red"><span class="aui-icon aui-icon-small aui-iconfont-time"></span> ${effectiveHours}h</b></div>`;

    return Utils.getHtmlFromString(htmlString);
  }

  function getInProgressIssues(issueData) {
    return issueData.filter((f) => !['To Do'].includes(f.status) && !f.isDone);
  }

  function getAllIssueCardsByIssueKey() {
    const cards = [...document.getElementsByClassName('ghx-issue')];

    const htmlCardMap = cards.reduce((obj, card) => {
      const id = card.getAttribute('data-issue-key');
      return {
        ...obj,
        [id]: card,
      };
    }, {});

    return htmlCardMap;
  }

  async function highlightInProgressIssuesHoursElapsed(issueData) {
    if (!issueData.length) {
      return;
    }

    if (!(await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED))) {
      [...document.getElementsByClassName(TIME_ELAPSED_CLASS_NAME)].forEach((q) => q.remove());
      return;
    }

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

  function _getStatsWrapper() {
    let statsWrapperElem = document.getElementById(CUSTOM_SPRINT_STATS_WRAPPER_ID);

    if (!statsWrapperElem) {
      const headerElem = document.getElementById('ghx-operations');
      if (!headerElem) {
        return null;
      }

      const statsWrapper = Utils.getHtmlFromString(
        `<div id="${CUSTOM_SPRINT_STATS_WRAPPER_ID}" style="z-index: 15;">
        </div>`,
      );
      headerElem.insertBefore(statsWrapper, headerElem.firstChild);

      statsWrapperElem = document.getElementById(CUSTOM_SPRINT_STATS_WRAPPER_ID);
    }

    return statsWrapperElem;
  }

  function appendHtmlStringToHeader(newElementSelector, html) {
    let htmlElem;
    if (typeof html === 'string') {
      htmlElem = Utils.getHtmlFromString(html);
    } else {
      htmlElem = html;
    }

    const headerElem = _getStatsWrapper();

    if (!headerElem) {
      return;
    }

    const existingElem = headerElem.querySelector(newElementSelector);
    if (existingElem) {
      existingElem.remove();
    }

    headerElem.appendChild(htmlElem);
  }

  function populateEpicCompletionData(epicCompletionData) {
    if (!epicCompletionData.length) {
      return;
    }

    const headerElem = _getStatsWrapper();

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

    headerElem.appendChild(container);

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

  function isStatusInReview(status) {
    return (
      (status.toLowerCase().includes('peer') || status.toLowerCase().includes('code')) &&
      status.toLowerCase().includes('review')
    );
  }

  function getFreeReviewersSet(issueData) {
    const allPeople = new Set(issueData.map((i) => i.assignee));
    const inReview = issueData.filter((i) => isStatusInReview(i.status));

    const reviewersInReview = new Set(inReview.flatMap((i) => i.reviewers));
    const freeReviewers = Array.from(allPeople).filter((person) => !reviewersInReview.has(person));
    return new Set(freeReviewers);
  }

  function populateAssigneeData(issueData) {
    const headerElem = _getStatsWrapper();
    if (!headerElem) {
      return;
    }

    const assignedTasksData = Utils.groupBy(issueData, 'assignee');

    const freePeople = getFreeReviewersSet(issueData);

    const dataArray = Object.keys(assignedTasksData).reduce((arr, assigneeName) => {
      const assignedTasks = assignedTasksData[assigneeName] || [];
      const totalPoints = assignedTasks.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
      const isFree = freePeople.has(assigneeName) && assignedTasks.length < 3;

      const person = {
        name: assigneeName,
        count: assignedTasks.length,
        isFree,
        points: totalPoints,
      };
      return [...arr, person];
    }, []);

    if (!dataArray.length) {
      return;
    }

    const getHtml = (assignee) => {
      const elem = Utils.getHtmlFromString(`<span 
        class="aui-label ghx-jira-plugin-assignee-selector"
        style="cursor: pointer; padding: 5px; font-weight: 600; color: gray; font-size: ${HEADER_STATS_FONT_SIZE}">
          ${assignee.name}: ${+Number(assignee.points).toFixed(2)} pts ${assignee.isFree ? '(free)' : ''}
        </span>`);

      function toggleAssigneeFilter(e, assigneeName) {
        const isSelected = e.style.border.includes('blue');

        if (!isSelected) {
          sprintIssueFilters.byAssignee.set(assigneeName);
          e.style.border = '1px solid blue';
        } else {
          sprintIssueFilters.byAssignee.reset();
        }
      }

      elem.addEventListener('click', (e) => {
        toggleAssigneeFilter(e.target, assignee.name);
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

    headerElem.appendChild(container);

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
      const epicHtml = getHtml(assignee);
      existingElem.appendChild(epicHtml);
    }
  }

  function isStatusInProgressOrReview(status) {
    return isStatusInReview(status) || status.toLowerCase().includes('in progress');
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

  async function populateReviewerData(issueData) {
    const dataArray = getReviewerData(issueData);

    if (!(await localStorageService.get(options.flags.SHOW_REVIEW_COUNTS_ENABLED))) {
      removeReviewerCountsData();
      return;
    }

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
    const totalPoints = +Number(
      issueData.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    ).toFixed(2);

    const { statusCountMap, pointsMap } = issueData.reduce(
      (map, issue) => {
        const status = issue.status.toUpperCase();

        const newStatusMap = { ...map.statusCountMap };
        newStatusMap[status] = (newStatusMap[status] || 0) + 1;
        map.statusCountMap = newStatusMap;

        const newPointsMap = { ...map.pointsMap };
        newPointsMap[status] = (newPointsMap[status] || 0) + (issue.storyPoints || 0);
        map.pointsMap = newPointsMap;
        return map;
      },
      {
        statusCountMap: {},
        pointsMap: {},
      },
    );

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

      const statusColor = getStatusColor(columnStatus);

      headerElement.style.borderBottom = `4px solid ${statusColor}`;

      const statusCount = statusCountMap[columnStatus] || 0;
      const statusPoints = +Number(pointsMap[columnStatus] || 0).toFixed(2);

      const pointPercentage = totalPoints === 0 ? 0 : Utils.toFixed((100 * statusPoints) / totalPoints);
      const html = Utils.getHtmlFromString(
        `<span><span style="color: ${statusColor}">${columnStatus} (${statusCount || 0} Tsk, ${statusPoints} Pt, ${pointPercentage}%)</span></span>`,
      );
      headerTitleElem.innerHTML = html.innerHTML;
    });
  }

  function getStoryPointsBreakdown(issueData) {
    let todoPoints = 0;
    let inProgressPoints = 0;
    let inCodeReviewPoints = 0;
    let productReviewPoints = 0;
    let donePoints = 0;

    for (const issue of issueData) {
      const storyPoints = issue.storyPoints || 0;
      if (issue.isDone) {
        donePoints += storyPoints;
      } else if (issue.status.toLowerCase() === 'to do') {
        todoPoints += storyPoints;
      } else if (issue.status.toLowerCase() === 'in progress') {
        inProgressPoints += storyPoints;
      } else if (isInReviewStatus(issue)) {
        inCodeReviewPoints += storyPoints;
      } else if (issue.status.toLowerCase() === 'product review') {
        productReviewPoints += storyPoints;
      }
    }

    return {
      todoPoints,
      inProgressPoints,
      inCodeReviewPoints,
      productReviewPoints,
      donePoints,
    };
  }

  function getTaskCountBreakdown(issueData) {
    let todo = 0;
    let inProgress = 0;
    let codeReview = 0;
    let productReview = 0;
    let done = 0;

    for (const issue of issueData) {
      if (issue.isDone) {
        done++;
      } else if (issue.status.toLowerCase() === 'to do') {
        todo++;
      } else if (issue.status.toLowerCase() === 'in progress') {
        inProgress++;
      } else if (
        ['in progress', 'code review', 'peer review', 'pr review'].includes(
          issue.status.toLowerCase(),
        )
      ) {
        codeReview++;
      } else if (issue.status.toLowerCase() === 'product review') {
        productReview++;
      }
    }

    return {
      todo,
      inProgress,
      codeReview,
      productReview,
      done,
    };
  }

  function getStatusPercentageBreakdown(pointBreakdown, totalPoints) {
    const { donePoints, inProgressPoints, inCodeReviewPoints, productReviewPoints, todoPoints } =
      pointBreakdown;

    const todo = Math.round(100 * Utils.toFixed(todoPoints / totalPoints));
    const inCodeReview = Math.round(100 * Utils.toFixed(inCodeReviewPoints / totalPoints));
    const inProductReview = Math.round(100 * Utils.toFixed(productReviewPoints / totalPoints));
    const isDone = Math.round(100 * Utils.toFixed(donePoints / totalPoints));
    let inProgress = Math.round(100 * Utils.toFixed(inProgressPoints / totalPoints));

    // adjust for rounding error
    const sumTotal = todo + inProgress + inCodeReview + inProductReview + isDone;
    const diff = 100 - sumTotal;
    if (diff > 0) {
      inProgress += diff;
    }

    return {
      todo,
      inProgress,
      inCodeReview,
      inProductReview,
      isDone,
    };
  }

  function enableHover(anchorId, dropdownId, shownVar) {
    // hover behavior
    const anchor = document.getElementById(anchorId);
    const floating = document.getElementById(dropdownId);

    if (!anchor || !floating) {
      return;
    }

    // visible
    anchor.addEventListener('mouseenter', () => {
      floating.style.display = 'block';
      visiblePopups[shownVar] = true;
    });

    // hidden
    anchor.addEventListener('mouseleave', () => {
      floating.style.display = 'none';
      visiblePopups[shownVar] = false;
    });
  }

  function getProgressBarComponentByStatus({
    issueData,
    totalPoints,
    percentageBreakdown,
    elementId,
    barWidth,
    height = 26,
  }) {
    const totalTasks = issueData.length;

    const todoWidth = Utils.toFixed((barWidth * percentageBreakdown.todo) / 100);
    const inProgressWidth = Utils.toFixed((barWidth * percentageBreakdown.inProgress) / 100);
    const inCodeReviewWidth = Utils.toFixed((barWidth * percentageBreakdown.inCodeReview) / 100);
    const productReviewWidth = Utils.toFixed(
      (barWidth * percentageBreakdown.inProductReview) / 100,
    );
    const doneWidth = Utils.toFixed((barWidth * percentageBreakdown.isDone) / 100);

    const progressElem = `<div id="${elementId}" style="position: relative;">
        <div style="height: ${height}px; width: ${barWidth}px; border: 1px solid gray; border-radius: 3px; display: grid; grid-template-columns: ${todoWidth}px ${inProgressWidth}px ${inCodeReviewWidth}px ${productReviewWidth}px ${doneWidth}px;">
          <div class="ghx-progressBar-status-component" style="background: ${getStatusColor(STATUSES.TODO)}; width: ${todoWidth}px;"> </div>
          <div class="ghx-progressBar-status-component" style="background: ${getStatusColor(STATUSES.IN_PROGRESS)}; width: ${inProgressWidth}px;"></div>
          <div class="ghx-progressBar-status-component" style="background: ${getStatusColor(STATUSES.CODE_REVIEW)}; width: ${inCodeReviewWidth}px;"></div>
          <div class="ghx-progressBar-status-component" style="background: ${getStatusColor(STATUSES.PRODUCT_REVIEW)}; width: ${productReviewWidth}px;"></div>
          <div class="ghx-progressBar-status-component" style="background: ${getStatusColor(STATUSES.DONE)}; width: ${doneWidth}px;"></div>
        </div>
        <div style="margin: auto; color: white;position: absolute;top: 20%;font-weight: 500;font-size: 12px;width: ${barWidth}px;text-align: center;">
          ${totalTasks} Tasks / ${totalPoints} Points
        </div>
    </div>`;

    return progressElem;
  }

  function getPointWiseStatsTable({
    taskCount,
    totalPoints,
    taskCountBreakdown,
    pointBreakdown,
    percentageBreakdown,
  }) {
    const trStyle = 'border-bottom: 1px solid lightgray; height: 30px;';
    const labelTable = `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr style="${trStyle}; font-weight: 500;">
        <td style="text-align: left;"></td>
        <td style="text-align: left;">Tickets</td>
        <td style="text-align: left;">Points</td>
        <td style="text-align: right;"></td>
      </tr>
      <tr style="${trStyle}">
        <td style="text-align: left;">Total</td>
        <td style="text-align: left;">${taskCount}</td>
        <td style="text-align: left;">${totalPoints}</td>
        <td style="text-align: right;"></td>
      </tr>
      <tr style="${trStyle}">
        <td style="text-align: left; font-weight: 600; color: ${getStatusColor('TO DO')}">To Do</td>
        <td style="text-align: left;">${taskCountBreakdown.todo}</td>
        <td style="text-align: left;">${pointBreakdown.todoPoints}</td>
        <td style="text-align: right;">${percentageBreakdown.todo}%</td>
      </tr>
      <tr style="${trStyle}">
        <td style="text-align: left; font-weight: 600; color: ${getStatusColor('IN PROGRESS')}">In Progress</td>
        <td style="text-align: left;">${taskCountBreakdown.inProgress}</td>
        <td style="text-align: left;">${pointBreakdown.inProgressPoints}</td>
        <td style="text-align: right;">${percentageBreakdown.inProgress}%</td>
      </tr>
      <tr style="${trStyle}">
        <td style="text-align: left; font-weight: 600; color: ${getStatusColor('CODE REVIEW')}">Code Review</td>
        <td style="text-align: left;">${taskCountBreakdown.codeReview}</td>
        <td style="text-align: left;">${pointBreakdown.inCodeReviewPoints}</td>
        <td style="text-align: right;">${percentageBreakdown.inCodeReview}%</td>
      </tr>
      <tr style="${trStyle}">
        <td style="text-align: left; font-weight: 600; color: ${getStatusColor('PRODUCT REVIEW')}">Product Review</td>
        <td style="text-align: left;">${taskCountBreakdown.productReview}</td>
        <td style="text-align: left;">${pointBreakdown.productReviewPoints}</td>
        <td style="text-align: right;">${percentageBreakdown.inProductReview}%</td>
      </tr>
      <tr style="height: 30px;">
        <td style="text-align: left; font-weight: 600; color: ${getStatusColor('DONE')}">Done</td>
        <td style="text-align: left;">${taskCountBreakdown.done}</td>
        <td style="text-align: left;">${pointBreakdown.donePoints}</td>
        <td style="text-align: right;">${percentageBreakdown.isDone}%</td>
      </tr>
    </table>`;
    return labelTable;
  }

  function getEpicWiseProgressBars({ issueData }) {
    const byEpic = Utils.groupBy(issueData, 'epicName');

    const epicWiseProgress = `${Object.keys(byEpic)
      .map((key) => {
        const issuesForEpic = byEpic[key];
        const totalPointsForEpic = issuesForEpic.reduce(
          (sum, issue) => sum + (issue.storyPoints || 0),
          0,
        );
        const pointBreakdownForEpic = getStoryPointsBreakdown(issuesForEpic);
        const percentageBreakdownForEpic = getStatusPercentageBreakdown(
          pointBreakdownForEpic,
          totalPointsForEpic,
        );
        return `<tr>
        <td style="padding: 8px 0px;">${key || 'N/A'}</td>
        <td style="text-align:right;">
          <div style="float: right;" align="right">
            ${getProgressBarComponentByStatus({
              issueData: issuesForEpic,
              barWidth: 150,
              elementId: `${key}-epic-progressBar`,
              percentageBreakdown: percentageBreakdownForEpic,
              totalPoints: totalPointsForEpic,
            })}
          </div>
        </td>
      </tr>`;
      })
      .join(' ')}`;

    return `<table style="width:100%">
      <tbody>
        ${epicWiseProgress}
      </tbody>
    </table>`;
  }

  function getProgressBarHoverElement({
    issueData,
    totalPoints,
    taskCountBreakdown,
    pointBreakdown,
    percentageBreakdown,
    elementId,
  }) {
    const taskCount = issueData.length;

    const labelTable = getPointWiseStatsTable({
      taskCount,
      totalPoints,
      taskCountBreakdown,
      pointBreakdown,
      percentageBreakdown,
    });

    const epicProgressBars = getEpicWiseProgressBars({
      issueData,
    });

    const display = visiblePopups.progressBar ? 'block' : 'none';
    return `<div id="${elementId}" style="width: 320px; position: relative; background: white; z-index: 2000; display: ${display}; border: 1px solid lightgray; border-radius: 5px; padding: 5px 10px;">  
      ${labelTable}
      <hr />
      <div style="font-weight: 500">Epics</div>
      ${epicProgressBars}
    </div>`;
  }

  function renderProgressBar(issueData) {
    const parent = document.querySelector('.ghx-sprint-meta');

    const progressBarElementId = 'ghx-progressBar-wrapper';
    const progressBarContainerId = 'ghx-sprint-progress-bar-container';

    const barWidth = 200;

    const totalPoints = Utils.toFixed(
      issueData.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      2,
    );
    const pointBreakdown = getStoryPointsBreakdown(issueData);
    const percentageBreakdown = getStatusPercentageBreakdown(pointBreakdown, totalPoints);
    const taskCountBreakdown = getTaskCountBreakdown(issueData);

    const progressElem = getProgressBarComponentByStatus({
      issueData,
      elementId: progressBarElementId,
      barWidth,
      totalPoints,
      percentageBreakdown,
    });

    const progressBarHoverComponentId = 'ghx-progressBar-hoverComponent';
    const progressBarHtmlString = `<div id="${progressBarContainerId}" style="background: white; float:left; margin-left: 10px; margin-right: 10px; width: ${barWidth}px; height: 26px; position: relative; display: inline-block; padding: 0px 5px;">
      ${progressElem}
      <div style="height: 5px;"></div>
      ${getProgressBarHoverElement({
        elementId: progressBarHoverComponentId,
        issueData,
        percentageBreakdown,
        pointBreakdown,
        taskCountBreakdown,
        totalPoints,
      })}
    </div>`;

    const progressBarHtml = Utils.getHtmlFromString(progressBarHtmlString);

    const existingElem = document.getElementById(progressBarContainerId);
    if (existingElem) {
      existingElem.remove();
    }
    if (parent) {
      parent.insertBefore(progressBarHtml, parent.firstChild);
    }

    // hover behavior
    enableHover(progressBarContainerId, progressBarHoverComponentId, 'progressBar');
  }

  function renderStatsHoverButton(issueData) {
    const parent = document.querySelector('.ghx-sprint-meta');

    const elementId = 'ghx-stats-button-wrapper';
    const elementContainerId = 'ghx-stats-button-container';

    const barWidth = 40;

    const hoverComponentId = 'ghx-stats-button-hoverComponent';

    const display = visiblePopups.statsButton ? 'block' : 'none';
    const popupHtml = `<div id="${hoverComponentId}" style="width: 320px; position: relative; background: white; z-index: 2000; top: 5px; display: ${display}; border: 1px solid lightgray; border-radius: 5px; padding: 5px 10px;">  
      hello there
    </div>`;

    const htmlString = `<div id="${elementContainerId}" style="background: white; float:left; margin-left: 10px; margin-right: 10px; width: ${barWidth}px; height: 26px; position: relative; display: inline-block; padding: 0px 5px;">
      Click Here  
    ${popupHtml}
    </div>`;

    const elementHtml = Utils.getHtmlFromString(htmlString);

    const existingElem = document.getElementById(elementContainerId);
    if (existingElem) {
      existingElem.remove();
    }
    if (parent) {
      parent.insertBefore(elementHtml, parent.firstChild);
    }

    // hover behavior
    enableHover(elementId, hoverComponentId, 'statsButton');
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

  function removeReviewerCountsData() {
    const elem = document.getElementById('ghx-header-reviewer-task-counts');
    if (elem) {
      elem.remove();
    }
  }

  async function populateReviewerPairData(issuesData) {
    if (!issuesData.length) {
      return;
    }

    if (!(await localStorageService.get(options.flags.SHOW_REVIEW_PAIRS_ENABLED))) {
      removeReviewerPairData();
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
    if (dataArray.length > 0) {
      dataArray.forEach((pairData) => {
        const epicHtml = getHtml(pairData);
        htmlString += epicHtml;
      });
    } else {
      htmlString += `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${HEADER_STATS_FONT_SIZE}">
        N/A
      </span>`;
    }

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
  style="position: absolute;top: 0;right: 20px;width: 120px;border: 1px solid lightgray;border-radius: 3px;padding: 8px 10px;z-index: 3000;background: white;"
>
  <input id="ghx-board-search-input" placeholder="Search here" spellcheck="false" style="border: none; border-radius: 3px; color: #666; width: 90px;"></input>
  <span id="ghx-board-search-icon" class="js-search-trigger ghx-iconfont aui-icon aui-icon-small aui-iconfont-search-small" style="position: absolute; right: 10px; top: 28%; color: #666; background: white;">
  </span>
</div>`;

    const element = Utils.getHtmlFromString(html);
    const parent = document.getElementById('ghx-operations');
    if (!parent) {
      return;
    }
    parent.appendChild(element);

    addSprintSearchBarBehavior();
  }

  function getReviewerSuggestions(issueData) {
    const inCodeReviewWithoutReviewer = issueData.filter(
      (i) => isInReviewStatus(i) && !(i.reviewers || []).length,
    );

    const peopleArray = getReviewerData(issueData); // all people

    const availableReviewers = peopleArray.sort((a, b) => {
      if (a.count === b.count) {
        return a.name - b.name;
      }
      return a.count - b.count;
    });

    // Iterate through issues and assign potential reviewers
    const updatedIssueArray = inCodeReviewWithoutReviewer.map((issue, index) => {
      const potentialReviewers = availableReviewers.filter((a) => a.name !== issue.assignee);

      const wrappedIndex = index % potentialReviewers.length;
      const nextIndex = (wrappedIndex + 1) % potentialReviewers.length;

      const suggestedReviewers = [];
      if (potentialReviewers[wrappedIndex]) {
        suggestedReviewers.push(potentialReviewers[wrappedIndex].name.split(' ').shift());
      }

      if (potentialReviewers[nextIndex]) {
        suggestedReviewers.push(potentialReviewers[nextIndex].name.split(' ').shift());
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
        innerFieldContent.innerText = `Suggested Reviewer: ${potentialReviewer}`;
      }
    }
  }

  async function renderStats(issueData) {
    populateEpicCompletionData(getEpicCompletionData(issueData));
    populateAssigneeData(issueData);

    await populateReviewerData(issueData);

    await populateReviewerPairData(issueData);
  }

  async function hashJson(jsonObject) {
    const jsonString = JSON.stringify(jsonObject);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return {
      hash: hashHex,
      time: Date.now(),
    };
  }

  function isRendered() {
    return Boolean(
      document.getElementById('ghx-custom-stats-wrapper') ||
        document.getElementById('ghx-sprint-progress-bar-container'),
    );
  }

  function getTeamMemberSummary(issueData) {
    const summary = {};

    issueData.forEach((task) => {
      const assignee = task.assignee;
      const status = getNormalizedStatus(task.status);

      if (!summary[assignee]) {
        summary[assignee] = {
          [STATUSES.TODO]: { points: 0, tasks: 0 },
          [STATUSES.IN_PROGRESS]: { points: 0, tasks: 0 },
          [STATUSES.CODE_REVIEW]: { points: 0, tasks: 0 },
          [STATUSES.PRODUCT_REVIEW]: { points: 0, tasks: 0 },
          [STATUSES.DONE]: { points: 0, tasks: 0 },
          Summary: { points: 0, tasks: 0 },
        };
      }

      if (Object.values(STATUSES).includes(status)) {
        summary[assignee][status].points += task.storyPoints;
        summary[assignee][status].tasks += 1;
        summary[assignee]['Summary'].points += task.storyPoints;
        summary[assignee]['Summary'].tasks += 1;
      } else {
        console.error(`status ${status} is not included in the status list`);
      }
    });
    return summary;
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

    // // const hashData = await hashJson(boardData);

    // // check hash within 5 minutes
    // // const hashTime = 1000 * 60 * 5; // 5 minutes
    // if (
    //   // localHashCache &&
    //   // localHashCache.hash === hashData.hash &&
    //   // Date.now() - hashData.time < hashTime &&
    //   isRendered()
    // ) {
    //   console.log('Skipping re-render, no change in data in 5 minutes');
    //   return;
    // } else {
    //   console.log('board data updated');
    //   // localHashCache = hashData;
    // }

    while(true) {
      const ticketItems = document.querySelectorAll('.ghx-issue-key-link')
      if (ticketItems.length > 0) {
        break
      } else {
        await Utils.delay(200)
      }
    }

    let issueData = getMappedIssueData(boardData);

    const issueKeysOnBoard = [...document.querySelectorAll('.ghx-issue-key-link')].map((i) => i.innerText.trim());

    issueData = issueData.filter((i) => issueKeysOnBoard.includes(i.issueKey));

    if (!issueData.length) {
      return;
    }

    showStatusColumnCounts(issueData);

    renderProgressBar(issueData);

    await highlightInProgressIssuesHoursElapsed(getInProgressIssues(issueData));

    await renderSearchHtmlElement();

    filterSprintIssuesV2();

    renderReviewerSuggestions(issueData);

    await renderStats(issueData);

    // renderStatsHoverButton(issueData);

    initSprintFilters();
  }

  await run();
}
