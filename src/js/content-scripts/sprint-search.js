function setSprintSearchBarIcon(mode) {
  const iconElement = document.getElementById('ghx-board-search-icon');
  // aui-iconfont-remove
  if (mode === 'reset') {
    iconElement.classList.remove('aui-iconfont-remove', 'aui-button');
    iconElement.classList.add('aui-iconfont-search-small');
  } else {
    iconElement.classList.remove('aui-iconfont-search-small');
    iconElement.classList.add('aui-iconfont-remove', 'aui-button');
  }
}

function resetIssueFilter() {
  [...document.getElementsByClassName('ghx-issue')].forEach((card) => {
    // eslint-disable-next-line
    card.style.display = 'block';
  });

  setSprintSearchBarIcon('reset'); // do we need this?
}

const JIRA_SPRINT_EPIC_SELECTOR_CLASS = 'ghx-jira-plugin-epic-selector';
const JIRA_SPRINT_ASSIGNEE_SELECTOR_CLASS = 'ghx-jira-plugin-assignee-selector';

function resetFilterSelectorCss(filterClassName) {
  [...document.getElementsByClassName(filterClassName)].forEach((elem) => {
    // eslint-disable-next-line
    elem.style.border = '1px solid #f4f5f7';
  });
}

function filterSprintIssuesV2(params = {}) {
  let {
    query = window.JIRA_PLUGIN_SPRINT_QUERY_FILTER,
    epic = window.JIRA_PLUGIN_SPRINT_EPIC_FILTER,
    assignee = window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER,
  } = params;

  if (query) {
    window.JIRA_PLUGIN_SPRINT_QUERY_FILTER = query;
  } else {
    query = window.JIRA_PLUGIN_SPRINT_QUERY_FILTER;
  }

  if (epic) {
    window.JIRA_PLUGIN_SPRINT_EPIC_FILTER = epic;
  } else {
    epic = window.JIRA_PLUGIN_SPRINT_EPIC_FILTER;
  }

  if (assignee) {
    window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER = assignee;
  } else {
    assignee = window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER;
  }

  const shouldResetFilter = !Object.keys(params).reduce(
    (arr, k) => [...arr, Boolean(params[k] ? params[k].trim() : '')],
    [],
  );

  if (shouldResetFilter) {
    // reset all cards
    resetIssueFilter();
    return;
  }

  const cards = [...document.getElementsByClassName('ghx-issue')];

  function isAllowed(card) {
    const checks = [];

    if (query) {
      checks.push(card.innerText.toLowerCase().trim().includes(query.toLowerCase().trim()));
    }

    if (epic) {
      checks.push(card.innerText.toLowerCase().trim().includes(epic.toLowerCase().trim()));
    }

    if (assignee) {
      const assigneeElement = card.querySelector('.ghx-avatar-img');
      if (assigneeElement) {
        const assigneeName = assigneeElement.alt.split('Assignee: ').pop();
        checks.push(assigneeName === assignee);
      }
    }

    return checks.every((p) => p);
  }

  cards.forEach((card) => {
    if (isAllowed(card)) {
      // eslint-disable-next-line
      card.style.display = 'block';
    } else {
      // eslint-disable-next-line
      card.style.display = 'none';
    }
  });
}

const sprintIssueFilters = {
  byQuery: {
    set: (query) => {
      window.JIRA_PLUGIN_SPRINT_QUERY_FILTER = query;

      if (query.length > 0) {
        setSprintSearchBarIcon('search');
      } else {
        setSprintSearchBarIcon('reset');
      }

      filterSprintIssuesV2();
    },
    reset: () => {
      window.JIRA_PLUGIN_SPRINT_QUERY_FILTER = null;

      document.getElementById('ghx-board-search-input').value = '';

      filterSprintIssuesV2();
    },
  },
  byEpic: {
    init: () => {
      const query = window.JIRA_PLUGIN_SPRINT_EPIC_FILTER;
      if (!query) {
        return;
      }

      const selected = [...document.getElementsByClassName('ghx-jira-plugin-epic-selector')].find(
        (e) => e.innerText.includes(query),
      );

      if (selected) {
        selected.style.border = '1px solid blue';
      }
    },
    set: (epicName) => {
      window.JIRA_PLUGIN_SPRINT_EPIC_FILTER = epicName;
      resetFilterSelectorCss(JIRA_SPRINT_EPIC_SELECTOR_CLASS);
      filterSprintIssuesV2();
    },
    reset: () => {
      window.JIRA_PLUGIN_SPRINT_EPIC_FILTER = null;
      resetFilterSelectorCss(JIRA_SPRINT_EPIC_SELECTOR_CLASS);
      filterSprintIssuesV2();
    },
  },
  byAssignee: {
    init: () => {
      const query = window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER;
      if (!query) {
        return;
      }

      const selected = [
        ...document.getElementsByClassName('ghx-jira-plugin-assignee-selector'),
      ].find((e) => e.innerText.includes(query));

      if (selected) {
        selected.style.border = '1px solid blue';
      }
    },
    set: (assigneeName) => {
      window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER = assigneeName;
      resetFilterSelectorCss(JIRA_SPRINT_ASSIGNEE_SELECTOR_CLASS);
      filterSprintIssuesV2();
    },
    reset: () => {
      window.JIRA_PLUGIN_SPRINT_ASSIGNEE_FILTER = null;
      resetFilterSelectorCss(JIRA_SPRINT_ASSIGNEE_SELECTOR_CLASS);
      filterSprintIssuesV2();
    },
  },
};

function initSprintFilters() {
  Object.keys(sprintIssueFilters).forEach((key) => {
    const fn = sprintIssueFilters[key].init;

    if (fn) {
      fn();
    }
  });
}

function addSprintSearchBarBehavior() {
  const inputElement = document.getElementById('ghx-board-search-input');

  inputElement.addEventListener('input', (e) => {
    const query = e.target.value;
    sprintIssueFilters.byQuery.set(query);
  });

  inputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.keyCode === 27) {
      sprintIssueFilters.byQuery.reset();
    }
  });

  const iconElement = document.getElementById('ghx-board-search-icon');

  iconElement.addEventListener('click', () => {
    sprintIssueFilters.byQuery.reset();
  });
}
