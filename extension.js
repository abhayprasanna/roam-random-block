//Add button (thanks Tyler Wince!)
const nameToUse = "randomBlock";
const bpIconName = "random";

const topbarButtonId = nameToUse + "-button-topbar";
const topBarFlexLeftSpaceId = nameToUse + "-flex-space-left";
const topBarFlexRightSpaceId = nameToUse + "-flex-space-right";

const leftSidebarButtonId = nameToUse + "-button-left-sidebar";

function addRandomButtonTopbar(extensionAPI) {
  // display Random Block button in topbar
  let checkForButton = document.getElementById(nameToUse + "-icon");
  if (!checkForButton) {
    let mainButton = document.createElement("span");
    mainButton.id = topbarButtonId;
    mainButton.classList.add("bp3-popover-wrapper");
    let spanTwo = document.createElement("span");
    spanTwo.classList.add("bp3-popover-target");
    mainButton.appendChild(spanTwo);
    var mainIcon = document.createElement("span");
    mainIcon.id = nameToUse + "-icon";
    mainIcon.classList.add(
      "bp3-icon-" + bpIconName,
      "bp3-button",
      "bp3-minimal",
      "bp3-small"
    );
    spanTwo.appendChild(mainIcon);
    var roamTopbar = document.getElementsByClassName("rm-topbar");
    var nextIconButton = roamTopbar[0].lastElementChild;
    nextIconButton.insertAdjacentElement("afterend", mainButton);

    var leftSpaceDiv = document.createElement("div");
    leftSpaceDiv.id = topBarFlexLeftSpaceId;
    leftSpaceDiv.className = "rm-topbar__spacer-sm";
    mainButton.insertAdjacentElement("beforebegin", leftSpaceDiv);

    var rightSpaceDiv = document.createElement("div");
    rightSpaceDiv.id = topBarFlexRightSpaceId;
    rightSpaceDiv.className = "rm-topbar__spacer-sm";
    mainButton.insertAdjacentElement("afterend", rightSpaceDiv);

    mainButton.addEventListener("click", () => toggleRandom(extensionAPI));
  }
}

function removeRandomButtonTopbar() {
  let domIdsToRemove = [topbarButtonId, topBarFlexLeftSpaceId, topBarFlexRightSpaceId];
  domIdsToRemove.forEach(domId => {
    let elem = document.getElementById(domId);
    if (elem) {
      elem.remove();
    }
  });
}

function addRandomButtonLeftSidebar(extensionAPI) { 
  // creates a new left sidebar log button below Daily Notes
  if (!document.getElementById(leftSidebarButtonId)) {
    var divRandom = document.createElement('div');
    divRandom.classList.add('log-button');
    divRandom.innerHTML = "Random Block";
    divRandom.id = leftSidebarButtonId;
    var spanRandom = document.createElement('span');
    spanRandom.classList.add('bp3-icon', 'bp3-icon-random', 'icon');
    divRandom.prepend(spanRandom);
    var sidebarcontent = document.querySelector("#app > div.roam-body > div.roam-app > div.roam-sidebar-container.noselect > div"),
        sidebartoprow = sidebarcontent.childNodes[1];
    if (sidebarcontent && sidebartoprow) {
      sidebartoprow.parentNode.insertBefore(divRandom, sidebartoprow.nextSibling);
    }
    divRandom.onclick = () => toggleRandom(extensionAPI);
  }
}

function removeRandomButtonLeftSidebar(){
  let domIdsToRemove = [leftSidebarButtonId];
  domIdsToRemove.forEach(domId => {
    let elem = document.getElementById(domId);
    if (elem) {
      elem.remove();
    }
  });
}

let RANDOM_BLOCK_QUEUE = [];
let VISITED_BLOCK_UIDS = new Set();

function clearState() {
  RANDOM_BLOCK_QUEUE = [];
  VISITED_BLOCK_UIDS = new Set();
}

function getPageTitleIfSet(extensionAPI) {
  // returns sanitized pageTitle or false
  let pageTitle = extensionAPI.settings.get("scope-to-this-page-setting");
  // Check if pageTitle is non-null, non-undefined, and non-empty
  if (pageTitle && (typeof pageTitle === "string")) {
    let cleanedUpPageTitle = pageTitle.trim();
    // make this handle both "Page title" and "[[Page title]]"
    if (cleanedUpPageTitle.startsWith('[[') && cleanedUpPageTitle.endsWith(']]')) {
      cleanedUpPageTitle = cleanedUpPageTitle.slice(2, -2);
    }
    if (cleanedUpPageTitle === "") {
      return false;
    }
    return cleanedUpPageTitle;
  } else {
    return false;
  }
}

function shuffleArrayInPlace(array) {
  // Fisher-Yates shuffle. The idea is to walk the array in the reverse order and swap each element with a random one before it
  //   from https://javascript.info/task/shuffle
  for (let i = array.length - 1; i > 0; i--) {
      // Generate a random index between 0 and i
      const j = Math.floor(Math.random() * (i + 1));  
      
      // Swap elements at indices i and j
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getCandidatesForRandomQueue(pageTitleIfSet) {
  // If we change the datascript queries here, we probably want to change them in `checkIfBlockExistsAndFulfillsCriteria` too
  if (pageTitleIfSet) {
    let candidatesForRandomQueue = window.roamAlphaAPI.q(`[
      :find [?block-uid ...]
      :in $ ?title
      :where
      [?page :node/title ?title]
      [?e :block/refs ?page]
      [?e :block/string ?text]
      [?e :block/uid ?block-uid]
    ]`, pageTitleIfSet);
    if (candidatesForRandomQueue.length === 0) {
      let errorMsg = `Error in Random Block Extension: No linked references found for the page named "${pageTitleIfSet}".\n\nPlease set up a page with linked references in Settings > Extension Settings > Random Block.`
      alert(errorMsg);
      throw Error(errorMsg);
    }
    // since we're getting all the linked references here (without using datascript's rand/sample), we have to shuffle it ourselves to give random ordering
    shuffleArrayInPlace(candidatesForRandomQueue);
    return candidatesForRandomQueue;
  } else {
    return window.roamAlphaAPI.q('[:find [(sample 100 ?block-uid)] :where [?e :block/page] [?e :block/uid ?block-uid]]')[0];
  }
}

function checkIfBlockExistsAndFulfillsCriteria(blockUid, pageTitleIfSet) {
  if (!blockUid) {
    return false;
  }
  if (pageTitleIfSet) {
    let blockPull = window.roamAlphaAPI.q(`[:find (pull ?e [:block/uid]) . :in $ ?block-uid ?page-title :where [?e :block/uid ?block-uid] [?page :node/title ?page-title] [?e :block/refs ?page]]`, blockUid, pageTitleIfSet);
    return blockPull && blockPull["uid"] === blockUid;
  } else {
    let blockPull = window.roamAlphaAPI.q(`[:find (pull ?e [:block/uid]) . :in $ ?block-uid :where [?e :block/uid ?block-uid]]`, blockUid);
    return blockPull && blockPull["uid"] === blockUid;
  }
}

function getUnvisitedRandomBlock(extensionAPI) {
  function rerunQuery() {
    // fetch new random blocks
    let candidatesForRandomQueue = getCandidatesForRandomQueue(pageTitleIfSet);
    let filteredCandidatesForRandomQueue = candidatesForRandomQueue.filter(blockUid => !VISITED_BLOCK_UIDS.has(blockUid));

    if (filteredCandidatesForRandomQueue.length === 0) {
      if (pageTitleIfSet) {
        // if here, means that we have visited all the linked refs of the page
        //   we know this because when pageTitleIfSet, we get all the backrefs (shuffled). So, if all of them are in VISITED_BLOCK_UIDS, we KNOW that we have visited all in this session
        //   in contrast, we cannot do that when we're showing global random blocks, because there is (an admittedly small) chance that the random 100 blocks we got were already visited, while there are other blocks which are not visited
        let cycledThroughAllMessage = `From Random Block Extension:\nFinished cycling through all the linked references for the page "${pageTitleIfSet}" in your current session.\nIf you press the "Random block" button again, will now repeat (in a different random order)\n(you can disable this alert from extension settings)`
        console.log(cycledThroughAllMessage);
        let alertWhenFullCycle = extensionAPI.settings.get("alert-when-full-cycle-setting");
        if (alertWhenFullCycle) {
          alert(cycledThroughAllMessage);
        }
      }
      clearState();
      filteredCandidatesForRandomQueue = getCandidatesForRandomQueue(pageTitleIfSet);
    }
    // called only when RANDOM_BLOCK_QUEUE is empty, so we can safely overwrite it
    RANDOM_BLOCK_QUEUE = filteredCandidatesForRandomQueue;
  }

  let pageTitleIfSet = getPageTitleIfSet(extensionAPI);
  if (RANDOM_BLOCK_QUEUE.length === 0) {
    rerunQuery();
  }
  // since we cache the results of the query, we might run into the issue of block having been deleted after first value run
  // also do not want to show blocks which might be corrupt
  while (true) {
    let blockUidToReturn = RANDOM_BLOCK_QUEUE.pop();
    if (checkIfBlockExistsAndFulfillsCriteria(blockUidToReturn, pageTitleIfSet)) {
      return blockUidToReturn;
    } else {
      console.log("Block deleted or corrupt or does not fit criteria, rerunning-query", blockUidToReturn);
      // if we run out of blocks here (should be veryy rare, unless a lot of the candidate blocks are deleted or do not fit the initial criteria), rerun the query and try again
      rerunQuery();
    }
  }
}

async function toggleRandom(extensionAPI) {
  // creates the URL for random page or block and opens it
  let randomBlockUid = getUnvisitedRandomBlock(extensionAPI);
  console.log("showing random block with uid:", randomBlockUid);
  VISITED_BLOCK_UIDS.add(randomBlockUid);
  window.roamAlphaAPI.ui.mainWindow
    .openBlock({block:
				{uid: randomBlockUid}});
}


function addAndRemoveButtonsAsRequired(extensionAPI){
  let value = extensionAPI.settings.get("where-show-button-setting") || "Both topbar and sidebar";
  if (value == "Only left sidebar"){
    // only show left sidebar
    addRandomButtonLeftSidebar(extensionAPI);
    removeRandomButtonTopbar();
  } else if (value == "Only topbar") {
    // only show topbar
    addRandomButtonTopbar(extensionAPI);
    removeRandomButtonLeftSidebar();
  } else {
    // default value: both topbar and sidebar
    addRandomButtonTopbar(extensionAPI);
    addRandomButtonLeftSidebar(extensionAPI);
  }
}

function onload({extensionAPI}) {
  clearState(); // just in case we're reloading and onunload did not run properly
  const panelConfig = {
    tabTitle: "Random Block",
    settings: [
      {
        id:     "where-show-button-setting",
        name:   "Display button location(s)",
        description: "Where do you want to display the Random Block button?",
        action: {
                  type:     "select",
                  items:    ["Both topbar and sidebar", "Only left sidebar", "Only topbar"],
                  onChange: (evt) => { 
                    // setTimeout
                    setTimeout(() => {
                      addAndRemoveButtonsAsRequired(extensionAPI);
                    }, 100);
                    // console.log("Select Changed!", evt); 
                  }
                }
      },
  
      {
        id:     "scope-to-this-page-setting",
        name:   "Scope to linked ref of particular page",
        description: "Enter a page title here to get a random linked reference of the page (If left empty, will get a random block in the full graph)",
        action: {
                  type:        "input",
                  placeholder: "Page title here",
                  onChange:    (evt) => { 
                                          clearState();
                                          // console.log("Input Changed!", evt); 
                                        }
                }
      },
      {
        id:          "alert-when-full-cycle-setting",
        name:        "Alert when full cycle?",
        description: "Do you want to get an alert when you cycle through all the linked refs in the current session? (only works when 'Scope to linked ref of particular page' above is set to a page title)",
        action:      {type: "switch"}
      },
    ]
  };
  extensionAPI.settings.panel.create(panelConfig);
  addAndRemoveButtonsAsRequired(extensionAPI);
  
  // set default values for the settings if hasn't ever been set
  let alertWhenFullCycle = extensionAPI.settings.get("alert-when-full-cycle-setting");
  if (!(alertWhenFullCycle===true || alertWhenFullCycle===false)){
    extensionAPI.settings.set("alert-when-full-cycle-setting", true);
  }
}

function onunload() {
  clearState();
  removeRandomButtonTopbar();
  removeRandomButtonLeftSidebar();
}

export default {
  onload: onload,
  onunload: onunload
}
