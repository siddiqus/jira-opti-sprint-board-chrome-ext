const CUSTOM_POPUP_CONTAINER_ID = 'custom-popup-container';
const CUSTOM_POUP_CONTENT_DIV_ID = 'custom-popup-content';
const CUSTOM_POPUP_CLOSE_BUTTON = 'custom-popup-close-btn';

// eslint-disable-next-line
function openPopup() {
  const popup = document.getElementById(CUSTOM_POPUP_CONTAINER_ID);

  if (popup) {
    popup.style.display = '';
  }
}

// eslint-disable-next-line
function closePopup() {
  const popup = document.getElementById(CUSTOM_POPUP_CONTAINER_ID);

  if (popup) {
    popup.style.display = 'none';
  }
}

// eslint-disable-next-line
function attachCustomPopupHtml() {
  if (!document.getElementById(CUSTOM_POPUP_CONTAINER_ID)) {
    const html =
      Utils.getHtmlFromString(`<div id="${CUSTOM_POPUP_CONTAINER_ID}" style="display: none; position: relative;">
      <div id="custom-popup-backdrop"
          style="position: fixed; width: 100vw; height: 100vh; background: black; z-index: 10; top: 0; left: 0; opacity: 20%;">
      </div>
      
      <div id="custom-popup-content-container"
          style="width: 60vw; height: 500px; position: fixed; border: 1px solid #999; top: 20%; z-index: 13; left: 20%; background: white; border-radius: 3px; padding: 10px;"
      >
        <div id="${CUSTOM_POUP_CONTENT_DIV_ID}"></div>
        <div
          id="${CUSTOM_POPUP_CLOSE_BUTTON}"
          class="ghx-iconfont aui-icon aui-icon-small aui-iconfont-remove"
          style="position: absolute; top: 10px; right: 10px; z-index: 21; color: #777; cursor: pointer;"
        ></div>
      </div>
    </div>`);

    document.getElementsByTagName('body')[0].append(html);
  }

  const closeBtn = document.getElementById(CUSTOM_POPUP_CLOSE_BUTTON);
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closePopup();
    });
  }
}

// eslint-disable-next-line
function openPopupWithContent(node) {
  const contentDiv = document.getElementById(CUSTOM_POUP_CONTENT_DIV_ID);

  contentDiv.replaceChild(node, contentDiv.firstChild);

  openPopup();
}

function attachPopupButton() {
  const button = Utils.getHtmlFromString(
    `<div id="custom-popup-button" class="aui-button" style="margin-left: 20px;">Click me</div>`,
  );

  button.addEventListener('click', () => {
    openPopup();
  });

  const existing = document.getElementById('custom-popup-button');
  if (existing) {
    return;
  }

  const sprintMeta = document.getElementsByClassName('ghx-sprint-meta');
  if (sprintMeta && sprintMeta.length > 0) {
    sprintMeta[0].appendChild(button);
  }
}
