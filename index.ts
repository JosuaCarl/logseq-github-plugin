import '@logseq/libs';
import { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user';
// import 'octokit'
import { Octokit, App } from 'octokit'
let octokit

let settings: SettingSchemaDesc[] = [
  {
    key: "GHIssuesAccessToken",
    type: "string",
    title: "Enter github personal access token",
    description: "Enter your personal access token here (optional for public repos)",
    default: "YOURTOKEN"
  },
  {
    key: "SearchQuery",
    type: "string",
    title: "Enter github search query",
    description: "Enter your desired search query here (see [searching-issues on Github](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests))",
    default: "repo:USERNAME/REPOSITORY state:open is:issue"
  },
  {
    key: "ReferenceTemplate",
    type: "string",
    title: "Insertion template for block 1",
    description: "Enter your desired template for the parent block, created by default for every return value of the query ",
    default: "TODO [[{Title}]]"
  },
  {
    key: "ContentTemplate",
    type: "string",
    title: "Insertion template for block 2",
    description: "Enter your desired template for the child block, created by default for every return value of the query ",
    default: "{Body}"
  }
]
logseq.useSettingsSchema(settings)

async function fetchGithubIssues(e) {
  logseq.App.showMsg('Fetching Issues...')
  octokit.request('GET /search/issues', {
    q: `${logseq.settings!.SearchQuery}`,
  }).then((response) => { insertBlocks(response) })
}


function applyTemplate(response, inputString) {
  var finalString = inputString
  
  finalString = finalString.replaceAll(/{Title}/gi, response.title)
  finalString = finalString.replaceAll(/{URL}/gi, response.html_url)
  finalString = finalString.replaceAll(/{Body}/gi, response.body)
  
  return finalString
}

function makeEmptyPage(pageName) {
  return logseq.Editor.createPage(
    pageName,
    {},
    {
      redirect: false,
      createFirstBlock: false,
      journal: false,
    },
  )
}

async function insertBlocks(response) {
  // Get current block position
  const currentBlock = await logseq.Editor.getCurrentBlock()

  for (const dataPoint in response.data.items) {
    // Define page name
    const pageName = response.data.items[dataPoint].title
    console.log(pageName)
    // Create page if not existent 
    let issuePage = await logseq.Editor.getPage(pageName)
    if (!issuePage) {
      issuePage = await makeEmptyPage(pageName)
    }

    // Append content to page
    if (logseq.settings!.ContentTemplate != "") {
      let contentText = applyTemplate(
        response.data.items[dataPoint],
        logseq.settings!.ContentTemplate
      )

      // Check whether Block is already on first level of page
      const issuePageTree = await logseq.Editor.getPageBlocksTree(issuePage!?.uuid)
      let foundContentText = false
      console.log(issuePageTree.toString())
      console.log(`len: ${issuePageTree.length}`)
      for (const i in issuePageTree) {
        console.log(`block: ${issuePageTree[i]}`)
        if (issuePageTree[i].content == contentText) {
          foundContentText = true
          break
        }
      }
      
      if (!foundContentText) {
        console.log(`Added ${contentText}`)
        const contentBlock = await logseq.Editor.appendBlockInPage(
          pageName,
          contentText,
        )
      }
    }

    // Insert reference
    let referenceText = applyTemplate(
      response.data.items[dataPoint],
      logseq.settings!.ReferenceTemplate
    )

    const referenceBlock = await logseq.Editor.insertBlock(
      currentBlock!.uuid,
      referenceText,
    )
  }
}



const main = async () => {
  let githubToken = logseq.settings!.GHIssuesAccessToken

  octokit = new Octokit({ auth: `${githubToken}` });
  logseq.Editor.registerSlashCommand('Fetch Github Issues', async (e) => {
    fetchGithubIssues(e)
  }
  )
}

logseq.ready(main).catch(console.error);
