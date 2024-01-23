const SPRINT_HEADER_ID = "#ghx-column-header-group";
const TIME_ELAPSED_CLASS_NAME = "ghx-issue-time-elapsed";

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

async function enhanceSprintBoard() {
  const baseUrl = "https://jira.sso.episerver.net";
  const urlParams = new URLSearchParams(window.location.search);

  const rapidViewId = urlParams.get("rapidView");
  const view = urlParams.get("view") || "";

  if (
    window.location.href.indexOf(baseUrl) === -1 ||
    view.includes("planning")
  ) {
    return;
  }

  function getNamesFromHtml(htmlString) {
    const nameRegex = /<div[^>]*>([\s\S]*?)<\/div>/;
    const match = htmlString.match(nameRegex);
    const extractedName = match ? match[1].trim() : null;
    return extractedName ? extractedName.split(",").map((s) => s.trim()) : null;
  }

  function getReviewersFromHtml(theIssue) {
    const reviewers = theIssue.extraFields.find(
      (f) => f.label === "Code Reviewers"
    );

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
      return "";
    }
    return epicMap[id].epicField.text;
  }

  function getMappedIssueData(boardData) {
    const { epics, statuses } = boardData.entityData;

    const issues = boardData.issuesData.issues;

    // questions
    // how long has this in the current column? (in-progress, code review, product review)

    const mappedIssues = issues.map((issue) => {
      const issueKey = issue.key;
      const assignee = issue.assigneeName;
      const epicName = getEpicNameFromId(epics, issue.epicId);

      const storyPoints = +issue.estimateStatistic.statFieldValue.value;

      const reviewers = getReviewersFromHtml(issue);

      const status = getStatusNameFromId(statuses, issue.statusId);
      const isDone = issue.done || status === "Done";

      const timeElapsedInStatusInHours = issue.timeInColumn
        ? Math.floor(
            (Date.now() - issue.timeInColumn.enteredStatus) / 1000 / 60 / 60
          )
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
      color = "gray";
    } else if (timeInHours < 48) {
      color = "coral";
    } else if (timeInHours < 72) {
      color = "maroon";
    } else {
      color = "red";
    }

    const htmlString = `<div class='${TIME_ELAPSED_CLASS_NAME} aui-label' style="border-radius: 2em; color:${color};float: right;margin-left: 10px;margin-right: auto;"><b color="red"><span class="aui-icon aui-icon-small aui-iconfont-time"></span> ${timeInHours}h</b></div>`;

    return Utils.getHtmlFromString(htmlString);
  }

  function getInProgressIssues(issueData) {
    return issueData.filter((f) => !["To Do"].includes(f.status) && !f.isDone);
  }

  function highlightInProgressIssuesHoursElapsed(issueData) {
    const cards = [...document.getElementsByClassName("ghx-issue")];

    const htmlCardMap = cards.reduce((obj, card) => {
      const id = card.getAttribute("id");
      obj[id] = card;
      return obj;
    }, {});

    for (const issue of issueData) {
      const htmlCard = htmlCardMap[issue.issueKey];
      if (!htmlCard) {
        continue;
      }

      const parentClass = "ghx-card-footer";
      const endDivClass = "ghx-days";

      const parentElem = htmlCard.querySelector(`.${parentClass}`);
      const endElem = htmlCard.querySelector(`.${endDivClass}`);

      const newHtmlElem = getTimeElapsedHtmlElement(
        issue.timeElapsedInStatusInHours
      );

      if (!newHtmlElem) {
        continue;
      }

      const existingElem = htmlCard.querySelector(
        `.${TIME_ELAPSED_CLASS_NAME}`
      );
      if (!existingElem) {
        parentElem.insertBefore(newHtmlElem, endElem);
      } else {
        existingElem.innerHTML = newHtmlElem.innerHTML;
      }
    }
  }

  function getEpicCompletionData(issueData) {
    const epicMap = issueData.reduce((obj, issue) => {
      const epicName = issue.epicName || "N/A";
      if (obj[epicName]) {
        obj[epicName].push(issue);
      } else {
        obj[epicName] = [issue];
      }
      return obj;
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
      headerElem.insertBefore(htmlElem, headerElem.firstChild);
    } else {
      existingElem.innerHTML = htmlElem.innerHTML;
    }
  }

  const headerStatsFontSize = "11px";

  function populateEpicCompletionData(epicCompletionData) {
    const htmlGenerator = (epic) => {
      return `<span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}"> ${epic.epicName} (${epic.doneCount}/${epic.totalCount}) </span>`;
    };
    let htmlString = `<div id="ghx-header-epic-counts" style="padding-top:5px;"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">EPICS:</span> `;

    epicCompletionData.sort((a, b) => b.totalCount - a.totalCount);

    for (const epic of epicCompletionData) {
      const epicHtml = htmlGenerator(epic);
      htmlString += epicHtml;
    }
    htmlString += "</div>";

    appendHtmlStringToHeader("#ghx-header-epic-counts", htmlString);
  }

  function populateAssigneeData(assignedTasksData) {
    const dataArray = Object.keys(assignedTasksData).reduce((arr, d) => {
      return [
        ...arr,
        {
          name: d,
          count: assignedTasksData[d].length,
        },
      ];
    }, []);
    dataArray.sort((a, b) => b.count - a.count);

    const htmlGenerator = (asigneeName, assigneeTasks) => {
      return `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${headerStatsFontSize}"> ${asigneeName}: ${assigneeTasks} </span>`;
    };
    const elementId = "ghx-header-assignee-task-counts";
    let htmlString = `<div id="${elementId}"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">ASSIGNED:</span>`;

    for (const assignee of dataArray) {
      const epicHtml = htmlGenerator(assignee.name, assignee.count);
      htmlString += epicHtml;
    }
    htmlString += "</div>";

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

  function populateReviewerData(reviewerData) {
    const dataArray = Object.keys(reviewerData).reduce((arr, d) => {
      return [
        ...arr,
        {
          name: d,
          count: reviewerData[d].length,
        },
      ];
    }, []);

    dataArray.sort((a, b) => b.count - a.count);

    const htmlGenerator = (asigneeName, assigneeTasks) => {
      return `<span class="aui-label" style="padding: 5px; font-weight: 600; color: gray; font-size: ${headerStatsFontSize}"> ${asigneeName}: ${assigneeTasks} </span>`;
    };
    const elementId = "ghx-header-reviewer-task-counts";
    let htmlString = `<div id="${elementId}"> <span class="aui-label" style="padding: 5px; font-weight: 600; font-size: ${headerStatsFontSize}">REVIEWS:</span>`;

    for (const reviewer of dataArray) {
      const epicHtml = htmlGenerator(reviewer.name, reviewer.count);
      htmlString += epicHtml;
    }
    htmlString += "</div>";

    appendHtmlStringToHeader(`#${elementId}`, htmlString);
  }

  function showStatusColumnCounts(issueData) {
    const statusCountMap = issueData.reduce((map, issue) => {
      const status = issue.status.toUpperCase();
      if (map[status]) {
        map[status]++;
      } else {
        map[status] = 1;
      }
      return map;
    }, {});

    function sanitizeProductReviewHeading(header) {
      // for team 7 board
      const upperCaseHeader = header.toUpperCase();
      return upperCaseHeader.includes("PRODUCT") &&
        upperCaseHeader.includes("REVIEW")
        ? "PRODUCT REVIEW"
        : upperCaseHeader;
    }

    const columnHeaders = [
      ...document.querySelectorAll(".ghx-column-headers .ghx-column"),
    ];
    columnHeaders.forEach((headerElement) => {
      const headerTitleElem = headerElement.querySelector(".ghx-column-title");
      let columnStatus = headerTitleElem.innerText
        .trim()
        .toUpperCase()
        .split(" (")[0];

      columnStatus = sanitizeProductReviewHeading(columnStatus);
      const statusCount = statusCountMap[columnStatus];
      const newDisplayText = `${columnStatus} (${statusCount || 0})`;
      headerTitleElem.innerText = newDisplayText;
    });
  }

  const boardUrl = getBoardUrl(baseUrl, rapidViewId);

  let boardData;
  try {
    boardData = await Utils.getFromUrl(boardUrl);
  } catch (error) {
    console.log(`Failed fetching board data`, error);
    return;
  }

  const issueData = getMappedIssueData(boardData);

  showStatusColumnCounts(issueData);

  if (await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)) {
    highlightInProgressIssuesHoursElapsed(getInProgressIssues(issueData));
  } else {
    [...document.getElementsByClassName(TIME_ELAPSED_CLASS_NAME)].forEach((q) =>
      q.remove()
    );
  }

  // for headers, these will be shown in the reverse order
  populateReviewerData(getReviewerData(issueData));
  populateAssigneeData(Utils.groupBy(issueData, "assignee"));
  populateEpicCompletionData(getEpicCompletionData(issueData));
}

async function enhanceBacklog() {
  const issuesLists = [...document.querySelectorAll(".ghx-backlog-container")];

  if (!issuesLists.length) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);

  const view = urlParams.get("view") || "";
  if (!view.includes("planning")) {
    return;
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
    const elements = [
      ...document.querySelectorAll('[id$="_totalPointsElement"]'),
    ];
    elements.forEach((e) => {
      e.remove();
    });
  }

  function refreshPointCount(element) {
    clearAllTotalCounts();

    const backlogId = element.querySelector(".ghx-name").innerText;

    const totalPointsElementId = `${backlogId}_totalPointsElement`.replace(
      /\s/g,
      "_"
    );

    const selectedIssues = [
      ...element.querySelectorAll(".js-issue.ghx-selected"),
    ];

    const totalPoints = selectedIssues.reduce((sum, issue) => {
      const countElem = issue.querySelector(
        ".ghx-estimate .ghx-statistic-badge"
      );
      const count = +countElem.innerText;
      return sum + count;
    }, 0);

    const totalPointsElem = getTotalPointsHtmlElement(
      totalPointsElementId,
      totalPoints
    );

    const existingElem = document.getElementById(totalPointsElementId);

    if (existingElem) {
      existingElem.innerText = totalPointsElem.innerText;
    } else {
      element.querySelector(".ghx-sprint-info").appendChild(totalPointsElem);
    }
  }

  issuesLists.forEach((issueList) => {
    issueList.addEventListener("click", async function (_event) {
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
}

async function setDefaults() {
  if (
    [undefined, null].includes(
      await localStorageService.get(options.flags.HOURS_IN_STATUS_ENABLED)
    )
  ) {
    localStorageService.set(options.flags.HOURS_IN_STATUS_ENABLED, true);
  }
}

async function run() {
  setDefaults();

  await enhanceSprintBoard();
  await enhanceBacklog();
}

async function loop(fn) {
  await fn();

  setInterval(async () => {
    await fn();
  }, 2000);
}

loop(run);
