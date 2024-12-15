// Function to parse an HTML table
function parseSprintReportTable(tableNode) {
  if (!tableNode || tableNode.tagName !== 'TABLE') {
    throw new Error('Invalid table node');
  }

  const headers = [];
  const rowsData = [];

  // Extract headers from the first row of the table (thead or first tr)
  const headerRow = tableNode.querySelector('thead tr') || tableNode.querySelector('tr');
  if (!headerRow) {
    throw new Error('Table has no header row');
  }

  headerRow.querySelectorAll('th').forEach((th) => {
    headers.push(th.textContent.trim());
  });

  // Extract data rows
  const rows = tableNode.querySelectorAll('tbody tr') || tableNode.querySelectorAll('tr');
  rows.forEach((row) => {
    const rowData = {};
    const cells = row.querySelectorAll('td');

    if (cells.length > 0) {
      cells.forEach((cell, index) => {
        const header = headers[index];
        if (header) {
          if (index === 0) {
            const link = cell.querySelector('a');
            rowData[header] = cell.textContent.trim(); // Keep the text content
            rowData['link'] = link ? link.href : null; // Add a separate property for the link
          } else {
            rowData[header] = cell.textContent.trim();
          }
        }
      });
      rowsData.push(rowData);
    }
  });

  return rowsData;
}

function formatStatus(status) {
  if (status === 'Done') {
    return 'DONE';
  }
  if (status === "Won't Fix") {
    return 'IGNORE';
  }

  return 'IN_PROGRESS';
}

function formatSprintReportData(tableData) {
  const results = tableData.map((t) => {
    const status = formatStatus(t.Status);
    const issueKey = t.Key.replace('*', '').trim();
    return {
      link: t.link,
      issueKey,
      description: t.Summary,
      issueType: t['Issue Type'],
      status,
    };
  });
  return results;
}

function getTableHtmlStringForIssues(tableDiv, filter) {
  if (!tableDiv) {
    return '';
  }

  const tableData = parseSprintReportTable(tableDiv);
  const formattedData = formatSprintReportData(tableData);
  const doneTasks = formattedData.filter(filter);

  const tasksStories = doneTasks.filter((d) => ['Task', 'Story'].includes(d.issueType));
  const bugs = doneTasks.filter((d) => ['Bug'].includes(d.issueType));

  return `<ul>
        <li> Stories / Tasks
            <ul>
                ${tasksStories
                  .map(
                    (task) => `<li>
                    <a href="${task.link}">${task.issueKey}</a>: ${task.description}
                </li>`,
                  )
                  .join(' ')}
            </ul>
        </li>
        <li> Bugs
            <ul>
                ${bugs
                  .map(
                    (task) => `<li>
                    <a href="${task.link}">${task.issueKey}</a>: ${task.description}
                </li>`,
                  )
                  .join(' ')}
            </ul>
        </li>
    </ul>`;
}

function getPresentableSprintReportHtml() {
  const tableDivContainer = document.querySelector('.ghx-sprint-report-table');
  if (!tableDivContainer) {
    return;
  }

  const completedTableUl = getTableHtmlStringForIssues(
    tableDivContainer.children[1],
    (f) => f.status === 'DONE',
  );
  const notCompletedTableUl = getTableHtmlStringForIssues(
    tableDivContainer.children[3],
    (f) => f.status === 'IN_PROGRESS',
  );

  const html = `<div>
    <h3>Completed</h3>
    ${completedTableUl}
    <h3>Not Completed</h3>
    ${notCompletedTableUl}
  </div>`;
  return Utils.getHtmlFromString(html);
}

const BUTTON_ID = 'ghx-show-sprint-demo-report-btn';

function getShowSprintReportDataButton() {
  const theButton = `<div id="${BUTTON_ID}" style="
        display: inline;
        margin: 20px;
        border: 1px solid lightgray;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 13px;">
        Show Sprint Review Report
    </div>`;

  const html = Utils.getHtmlFromString(theButton);

  html.addEventListener('click', () => {
    openPopupWithContent(getPresentableSprintReportHtml());
  });

  return html;
}

function mountShowSprintReportButton() {
  const chartActionsDiv = document.querySelector('#ghx-chart-actions div');

  if (!chartActionsDiv) {
    return;
  }
  if (!document.getElementById(BUTTON_ID)) {
    Utils.prepend(chartActionsDiv, getShowSprintReportDataButton());
  }
}

function enhanceSprintReport() {
  mountShowSprintReportButton();
}
