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

      const timeElapsedInStatusInHours = Math.max(
        0,
        issue.timeInColumn
          ? Math.floor((Date.now() - issue.timeInColumn.enteredStatus) / 1000 / 60 / 60)
          : 0,
      );

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
    const totalTasks = issueData.length;
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
      const statusCount = statusCountMap[columnStatus] || 0;
      const statusPoints = +Number(pointsMap[columnStatus] || 0).toFixed(2);

      const html = Utils.getHtmlFromString(
        `<span>${columnStatus} <span style="color: #909090; font-weight: 600;">(${statusCount || 0}/${totalTasks} Tasks, ${statusPoints}/${totalPoints} Points)</span><span>`,
      );
      headerTitleElem.innerHTML = html.innerHTML;
    });
  }

  function getStatusPercentageBreakdown(issueData) {
    let todoCount = 0;
    let inProgressCount = 0;
    let productReviewCount = 0;
    let doneCount = 0;

    for (const issue of issueData) {
      if (issue.isDone) {
        doneCount++;
      } else if (issue.status.toLowerCase() === 'to do') {
        todoCount++;
      } else if (
        ['in progress', 'code review', 'peer review', 'pr review'].includes(
          issue.status.toLowerCase(),
        )
      ) {
        inProgressCount++;
      } else if (issue.status.toLowerCase() === 'product review') {
        productReviewCount++;
      }
    }

    const total = issueData.length;
    const todo = Math.round(100 * Utils.toFixed(todoCount / total));
    const inProgress = Math.round(100 * Utils.toFixed(inProgressCount / total));
    const inProductReview = Math.round(100 * Utils.toFixed(productReviewCount / total));
    const isDone = Math.round(100 * Utils.toFixed(doneCount / total));

    // adjust for rounding error
    const sumTotal = todo + inProgress + inProductReview + isDone;
    const diff = 100 - sumTotal;
    if (diff > 0) {
      inProgress += diff;
    }

    return {
      todo,
      inProgress,
      inProductReview,
      isDone,
    };
  }

  function renderProgressBar(issueData) {
    const parent = document.querySelector('.ghx-sprint-meta');

    const donePoints = +Number(
      issueData.filter((i) => i.isDone).reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    ).toFixed(2);
    const totalPoints = +Number(
      issueData.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    ).toFixed(2);

    let percentage = totalPoints > 0 ? Math.round((100 * donePoints) / totalPoints) : 0;
    if (percentage <= 6) {
      percentage = 6; // this is to make the progress bar start look pretty
    }

    const progressBarId = 'ghx-sprint-progress-bar-container';
    const progressBarHoverComponentId = 'ghx-progressBar-hoverComponent';

    const progressBarBorderRadius = percentage < 94 ? '2em 2px 2px 2em' : '2em';

    const barWidth = 200; // px

    function renderStatusWiseProgress() {
      const breakdown = getStatusPercentageBreakdown(issueData);

      const todo = Utils.toFixed((200 * breakdown.todo) / 100);
      const inProgress = Utils.toFixed((200 * breakdown.inProgress) / 100);
      const productReview = Utils.toFixed((200 * breakdown.inProductReview) / 100);
      const done = Utils.toFixed((200 * breakdown.isDone) / 100);

      const inProgressWidth = todo + inProgress;
      const inProductReviewWidth = inProgressWidth + productReview;
      const doneWidth = inProductReviewWidth + done;

      return `<div class="ghx-progressBar-status-component" style="height: 26px; background: #81e489; border-radius: 0 2em 2em 0; width: ${todo}px; margin-bottom: 5px;"> TODO </div>
        <div class="ghx-progressBar-status-component" style="height: 26px; background: #81e489; border-radius: 0 2em 2em 0;width: ${inProgressWidth}px; margin-bottom: 5px;"> IN PROGRESS </div>
        <div class="ghx-progressBar-status-component" style="height: 26px; background: #81e489; border-radius: 0 2em 2em 0; width: ${inProductReviewWidth}px; margin-bottom: 5px;">PRODUCT REVIEW</div>
        <div class="ghx-progressBar-status-component" style="height: 26px; background: #81e489; border-radius: 0 2em 2em 0; width: ${doneWidth}px; margin-bottom: 5px;">DONE</div>`;
    }

    const progressBarHtmlString = `<div id="${progressBarId}" style="background: white; float:left; margin-left: 20px; margin-right: 20px; width: ${barWidth + 10}px; height: 26px; position: relative; display: inline-block; padding: 0px 5px;">
          <div id="ghx-progressBar-wrapper" style="border-radius: 2em; border: 1px solid gray;">
            <div id="ghx-progressBar" style="height: 26px; background: #3ea9ff;border-radius: ${progressBarBorderRadius};width: ${percentage}%;"></div>
            <span style="position: absolute; font-size: 12px; color: black; left: 25%; top: 18%; font-weight: 500; width: 120px; text-align: center;">
                ${donePoints} / ${totalPoints} points
            </span>
          </div>
          <div id="${progressBarHoverComponentId}" style="position: relative; background: white; z-index: 2000; top: 5px; transition: opacity 0.2s ease-in-out; opacity: 0">
            <div id="ghx-progressBar-wrapper">
              ${renderStatusWiseProgress()}
            </div>
          </div>
      </div>`;

    const progressBarHtml = Utils.getHtmlFromString(progressBarHtmlString);

    const existingElem = document.getElementById(progressBarId);
    if (existingElem) {
      existingElem.remove();
    }
    if (parent) {
      parent.insertBefore(progressBarHtml, parent.firstChild);
    }

    // // hover behavior
    const anchor = document.getElementById(progressBarId);
    const floating = document.getElementById(progressBarHoverComponentId);

    // visible
    anchor.addEventListener('mouseenter', () => {
      floating.style.opacity = 1;
    });

    // hidden
    anchor.addEventListener('mouseleave', () => {
      floating.style.opacity = 0;
    });
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
  style="position: absolute;top: 0;right: 20px;width: 196px;border: 1px solid lightgray;border-radius: 3px;padding: 8px 10px;z-index: 3000;background: white;"
>
  <input id="ghx-board-search-input" placeholder="Search here" spellcheck="false" style="border: none; border-radius: 3px; color: #666; width: 170px;"></input>
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
      (i) =>
        (i.status.toLowerCase().includes('code review') ||
          i.status.toLowerCase().includes('peer review')) &&
        !(i.reviewers || []).length,
    );

    const peopleArray = getReviewerData(issueData); // all people

    const availableReviewers = peopleArray.sort((a, b) => a.count - b.count);

    // Iterate through issues and assign potential reviewers
    const updatedIssueArray = inCodeReviewWithoutReviewer.map((issue, index) => {
      const potentialReviewers = availableReviewers.filter((a) => a !== issue.assignee);

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

    await highlightInProgressIssuesHoursElapsed(getInProgressIssues(issueData));

    await renderSearchHtmlElement();

    filterSprintIssuesV2();

    renderReviewerSuggestions(issueData);

    await renderStats(issueData);

    initSprintFilters();
  }

  await run();
}
