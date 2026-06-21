#!/usr/bin/env node

/**
 * process-backlog.js
 * Standalone zero-dependency Node.js CLI script to automate GitHub Project V2 backlog sync and spec refinement.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Resolved paths
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load configurations
function loadConfig() {
  const rootConfigPath = path.resolve(__dirname, '..', 'config.json');
  const localConfigPath = path.join(__dirname, 'batch-config.json');
  
  if (fs.existsSync(rootConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
    } catch (err) {
      console.error(`\x1b[31mError parsing root config.json: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }
  
  if (fs.existsSync(localConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    } catch (err) {
      console.error(`\x1b[31mError parsing batch-config.json: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }
  
  console.error(`\x1b[31mError: Project configuration file not found at ${rootConfigPath} or ${localConfigPath}\x1b[0m`);
  console.error('Please make sure config.json exists in the project root or batch-config.json exists in the scripts directory.');
  process.exit(1);
}

const config = loadConfig();
const SPECS_DIR = path.join(PROJECT_ROOT, config.specsDir || 'specs');
const BATCH_FILE_PATH = path.join(SPECS_DIR, 'active-batch.json');

// Retrieve GitHub Token
const tokenEnvVar = config.githubTokenEnvVar || 'GITHUB_PAT';
const token = process.env[tokenEnvVar];

function verifyToken() {
  if (!token) {
    console.error(`\x1b[31mError: Environment variable "${tokenEnvVar}" is not set.\x1b[0m`);
    console.error(`Please set the Personal Access Token with repo and project scopes:`);
    console.error(`  PowerShell: $env:${tokenEnvVar}="your_token_here"`);
    console.error(`  Bash/Cmd:   export ${tokenEnvVar}="your_token_here"`);
    process.exit(1);
  }
}

// GitHub Request Helper
function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': `${config.issueIdPattern || 'KQM'}-Backlog-Sync-Tool`,
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    const reqOptions = {
      hostname: 'api.github.com',
      port: 443,
      method: options.method || 'GET',
      path: options.path,
      headers: { ...defaultHeaders, ...options.headers }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = data ? JSON.parse(data) : {};
        } catch (e) {
          parsedData = { raw: data };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsedData);
        } else {
          reject({
            statusCode: res.statusCode,
            message: parsedData.message || parsedData.errors || 'API request failed',
            response: parsedData
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// GraphQL API Helper
async function graphqlQuery(query, variables = {}) {
  try {
    const result = await apiRequest({
      method: 'POST',
      path: '/graphql'
    }, { query, variables });
    if (result.errors) {
      throw new Error(result.errors.map(e => e.message).join(', '));
    }
    return result.data;
  } catch (err) {
    throw new Error(`GraphQL Query Failed: ${err.message || JSON.stringify(err)}`);
  }
}

// Project V2 Query definitions
const PROJECT_QUERY = `
query($owner: String!, $number: Int!, $isOrg: Boolean!) {
  organization(login: $owner) @include(if: $isOrg) {
    projectV2(number: $number) {
      ...ProjectFields
    }
  }
  user(login: $owner) @skip(if: $isOrg) {
    projectV2(number: $number) {
      ...ProjectFields
    }
  }
}

fragment ProjectFields on ProjectV2 {
  id
  title
  fields(first: 100) {
    nodes {
      ... on ProjectV2Field {
        id
        name
        dataType
      }
      ... on ProjectV2SingleSelectField {
        id
        name
        dataType
        options {
          id
          name
        }
      }
    }
  }
  items(first: 100) {
    nodes {
      id
      content {
        ... on Issue {
          id
          number
          title
          body
          url
          state
        }
      }
      fieldValues(first: 30) {
        nodes {
          ... on ProjectV2ItemFieldSingleSelectValue {
            field {
              ... on ProjectV2SingleSelectField {
                id
                name
              }
            }
            name
            optionId
          }
        }
      }
    }
  }
}
`;

// Helper to resolve Project Node
async function fetchProjectData() {
  const isOrg = config.ownerType === 'organization';
  const data = await graphqlQuery(PROJECT_QUERY, {
    owner: config.owner,
    number: config.projectNumber,
    isOrg: isOrg
  });

  const projectNode = isOrg ? data.organization.projectV2 : data.user.projectV2;
  if (!projectNode) {
    throw new Error(`Project #${config.projectNumber} not found for ${config.ownerType} "${config.owner}"`);
  }
  return projectNode;
}

// Main Commands
async function listBacklog(outputToFile = false) {
  console.log(`\n\x1b[36m>>> Fetching backlog items from Project #${config.projectNumber} (${config.owner}/${config.repository})...\x1b[0m`);
  
  const project = await fetchProjectData();
  const statusField = project.fields.nodes.find(f => f.name === config.statusFieldName);
  const priorityField = project.fields.nodes.find(f => f.name === config.priorityFieldName);

  if (!statusField) {
    throw new Error(`Status field "${config.statusFieldName}" not found in Project fields.`);
  }

  // Parse items
  const backlogItems = [];
  for (const item of project.items.nodes) {
    if (!item.content || !item.content.number) continue; // Skip non-issues (draft notes, pull requests)
    if (item.content.state !== 'OPEN') continue; // Skip closed issues

    let status = '';
    let priority = null;

    for (const val of item.fieldValues.nodes) {
      if (val.field && val.field.name === config.statusFieldName) {
        status = val.name;
      }
      if (val.field && val.field.name === config.priorityFieldName) {
        priority = val.name;
      }
    }

    const validPriorities = ['P0', 'P1', 'P2'];
    if (status === config.backlogStatusName && validPriorities.includes(priority)) {
      backlogItems.push({
        itemId: item.id,
        issueId: item.content.id,
        number: item.content.number,
        title: item.content.title,
        body: item.content.body,
        url: item.content.url,
        priority: priority
      });
    }
  }

  // Define Priority ordering
  const priorityWeights = { 'P0': 3, 'P1': 2, 'P2': 1 };
  backlogItems.sort((a, b) => {
    const weightA = priorityWeights[a.priority] || 0;
    const weightB = priorityWeights[b.priority] || 0;
    return weightB - weightA; // High priority first
  });

  if (backlogItems.length === 0) {
    console.log('\x1b[32mNo open issues found in the Backlog status! Codebase is in sync.\x1b[0m');
    return [];
  }

  console.log(`\nFound \x1b[33m${backlogItems.length}\x1b[0m backlog issues (sorted by priority):\n`);
  
  backlogItems.forEach((item, index) => {
    const priorityColor = item.priority === 'P0' ? '\x1b[31m' : item.priority === 'P1' ? '\x1b[33m' : '\x1b[32m';
    console.log(`  [${index + 1}] \x1b[1m#${item.number}\x1b[0m: ${item.title}`);
    console.log(`      Priority: ${priorityColor}${item.priority}\x1b[0m | ID: ${item.itemId}`);
  });

  if (outputToFile) {
    const batch = backlogItems.slice(0, config.batchSize);
    fs.writeFileSync(BATCH_FILE_PATH, JSON.stringify(batch, null, 2), 'utf8');
    console.log(`\n\x1b[32mSaved next active batch of size ${batch.length} to ${BATCH_FILE_PATH}\x1b[0m`);
    console.log('You can now inspect the file and use the AI agent to write specs for them!');
    return batch;
  }

  return backlogItems;
}

// Update Single Issue
async function updateIssue(issueNumber, specFilePath, splitIssuesFile = null) {
  console.log(`\n\x1b[36m>>> Refinement execution for Issue #${issueNumber}...\x1b[0m`);

  // Verify spec file exists
  const fullSpecPath = path.resolve(specFilePath);
  if (!fs.existsSync(fullSpecPath)) {
    throw new Error(`Spec file not found at: ${fullSpecPath}`);
  }
  const specContent = fs.readFileSync(fullSpecPath, 'utf8');

  // Load project details to fetch item and option IDs
  const project = await fetchProjectData();
  const statusField = project.fields.nodes.find(f => f.name === config.statusFieldName);
  if (!statusField) {
    throw new Error(`Status field "${config.statusFieldName}" not found in project.`);
  }
  const readyOption = statusField.options.find(opt => opt.name === config.readyStatusName);
  if (!readyOption) {
    throw new Error(`Ready status option "${config.readyStatusName}" not found in Status field options.`);
  }

  // Find the matching backlog project item ID
  let targetItem = null;
  for (const item of project.items.nodes) {
    if (item.content && item.content.number === parseInt(issueNumber, 10)) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) {
    throw new Error(`No project item found matching Issue #${issueNumber}`);
  }

  // Create folder under specs/<issue-code>/ and copy spec
  const prefix = config.issueIdPattern || 'KQM';
  const issueCode = `${prefix}-${issueNumber}`;
  const targetFolder = path.join(SPECS_DIR, issueCode);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  const finalSpecPath = path.join(targetFolder, 'specs.md');
  fs.writeFileSync(finalSpecPath, specContent, 'utf8');
  console.log(`\x1b[32mSuccessfully copied specification to local repository: ${finalSpecPath}\x1b[0m`);

  // Build GitHub public file link
  const githubSpecUrl = `https://github.com/${config.owner}/${config.repository}/blob/main/specs/${issueCode}/specs.md`;

  // Step 1: Add a comment to the GitHub issue linking the spec
  const commentBody = `### 📋 Technical Specification Refined\n\nI have created a technical specification based on the current codebase architecture.\n\n🔗 **View Technical Spec**: [specs.md](${githubSpecUrl})\n\nThis issue has been promoted to the **Ready** board column.`;
  await apiRequest({
    method: 'POST',
    path: `/repos/${config.owner}/${config.repository}/issues/${issueNumber}/comments`
  }, { body: commentBody });
  console.log(`\x1b[32mLinked spec in GitHub comment on Issue #${issueNumber}\x1b[0m`);

  // Step 2: Transition Project V2 Item to "Ready" status
  const transitionMutation = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
  `;
  await graphqlQuery(transitionMutation, {
    projectId: project.id,
    itemId: targetItem.id,
    fieldId: statusField.id,
    optionId: readyOption.id
  });
  console.log(`\x1b[32mMoved Project Item to "${config.readyStatusName}" status.\x1b[0m`);

  // Step 3: Handle Split Issues if provided
  if (splitIssuesFile) {
    const splitPath = path.resolve(splitIssuesFile);
    if (!fs.existsSync(splitPath)) {
      throw new Error(`Split issues json file not found at: ${splitPath}`);
    }
    const splits = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    console.log(`\x1b[33mSplitting Issue #${issueNumber} into ${splits.length} sub-tasks...\x1b[0m`);

    const addProjectMutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
    `;

    for (const sub of splits) {
      // Add sub spec if defined
      let subComment = `### 📋 Technical Sub-Task Spec\n\nPart of parent Issue #${issueNumber}.\n`;
      if (sub.specFile) {
        const subSpecPath = path.resolve(sub.specFile);
        if (fs.existsSync(subSpecPath)) {
          const subFolder = path.join(SPECS_DIR, issueCode);
          const subFinalPath = path.join(subFolder, path.basename(subSpecPath));
          fs.writeFileSync(subFinalPath, fs.readFileSync(subSpecPath, 'utf8'), 'utf8');
          const subGithubUrl = `https://github.com/${config.owner}/${config.repository}/blob/main/specs/${issueCode}/${path.basename(subSpecPath)}`;
          subComment += `\n🔗 **View Technical Spec**: [${path.basename(subSpecPath)}](${subGithubUrl})`;
        }
      }

      // Create new issue via REST API
      const newIssue = await apiRequest({
        method: 'POST',
        path: `/repos/${config.owner}/${config.repository}/issues`
      }, {
        title: `${sub.title} [Sub-task #${issueNumber}]`,
        body: `${sub.description || ''}\n\n---\n${subComment}`
      });
      console.log(`\x1b[32m  Created sub-issue #${newIssue.number}: "${newIssue.title}"\x1b[0m`);

      // Add to Project Board
      const addedItem = await graphqlQuery(addProjectMutation, {
        projectId: project.id,
        contentId: newIssue.node_id
      });
      const newItemId = addedItem.addProjectV2ItemById.item.id;

      // Set Status to Ready
      await graphqlQuery(transitionMutation, {
        projectId: project.id,
        itemId: newItemId,
        fieldId: statusField.id,
        optionId: readyOption.id
      });
      console.log(`\x1b[32m    Added sub-issue to project board as "${config.readyStatusName}"\x1b[0m`);
    }
  }

  console.log(`\n\x1b[32m🎉 Success! Issue #${issueNumber} refinement processing complete!\x1b[0m\n`);
}

// Mark Issue as In Progress
async function markInProgress(issueNumber) {
  console.log(`\n\x1b[36m>>> Marking Issue #${issueNumber} as In Progress...\x1b[0m`);

  const project = await fetchProjectData();
  const statusField = project.fields.nodes.find(f => f.name === config.statusFieldName);
  if (!statusField) {
    throw new Error(`Status field "${config.statusFieldName}" not found in project.`);
  }

  const inProgressStatusName = config.inProgressStatusName || 'In Progress';
  console.log('AVAILABLE_OPTIONS:', JSON.stringify(statusField.options)); const inProgressOption = statusField.options.find(opt => opt.name === inProgressStatusName);
  if (!inProgressOption) {
    throw new Error(`In Progress status option "${inProgressStatusName}" not found in Status field options.`);
  }

  let targetItem = null;
  for (const item of project.items.nodes) {
    if (item.content && item.content.number === parseInt(issueNumber, 10)) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) {
    console.log(`\x1b[33mSkipping: Issue #${issueNumber} not found in the project board.\x1b[0m\n`);
    return;
  }

  // Check current status — only transition if the issue is in "Ready"
  const readyStatusName = config.readyStatusName || 'Ready';
  let currentStatus = '';
  for (const val of targetItem.fieldValues.nodes) {
    if (val.field && val.field.name === config.statusFieldName) {
      currentStatus = val.name;
      break;
    }
  }

  if (currentStatus !== readyStatusName) {
    console.log(`\x1b[33mSkipping: Issue #${issueNumber} is currently "${currentStatus || '(none)'}" (not "${readyStatusName}"). No transition performed.\x1b[0m\n`);
    return;
  }

  const transitionMutation = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
  `;

  await graphqlQuery(transitionMutation, {
    projectId: project.id,
    itemId: targetItem.id,
    fieldId: statusField.id,
    optionId: inProgressOption.id
  });

  console.log(`\x1b[32mMoved Issue #${issueNumber} to "${inProgressStatusName}" status.\x1b[0m\n`);
}

// CLI Routing
const commandArgs = process.argv.slice(2);
const cmd = commandArgs[0];

if (!cmd || cmd === 'help' || cmd === '-h') {
  console.log(`
\x1b[36m=== GitHub Backlog Sync & Refinement CLI Tool ===\x1b[0m

Usage:
  node scripts/process-backlog.js <command> [args]

Commands:
  \x1b[1mlist\x1b[0m                                 Lists all active backlog issues sorted by priority.
  \x1b[1mfetch\x1b[0m                                Fetches the next batch of size "${config.batchSize}" and saves to specs/active-batch.json.
  \x1b[1min-progress <issue-num>\x1b[0m              Moves a project item to the "In Progress" status column.
  \x1b[1mupdate <issue-num> --spec-file <path>\x1b[0m   Creates a local folder under specs/, links spec in GitHub, and moves issue to "Ready".
  
Options:
  \x1b[1m--split-issues <json-path>\x1b[0m           Optionally split the issue into sub-issues and automatically add them to "Ready".
`);
  process.exit(0);
}

// Verify auth for any execution
verifyToken();

(async () => {
  try {
    if (cmd === 'list') {
      await listBacklog(false);
    } else if (cmd === 'fetch') {
      await listBacklog(true);
    } else if (cmd === 'in-progress') {
      const issueNumber = commandArgs[1];
      if (!issueNumber) {
        console.error('\x1b[31mError: Missing issue number. Usage: node scripts/process-backlog.js in-progress <issue-number>\x1b[0m');
        process.exit(1);
      }
      await markInProgress(issueNumber);
    } else if (cmd === 'update') {
      const issueNumber = commandArgs[1];
      if (!issueNumber) {
        console.error('\x1b[31mError: Missing issue number parameter. Usage: node scripts/process-backlog.js update <issue-number> --spec-file <path>\x1b[0m');
        process.exit(1);
      }

      // Parse named options
      let specFile = null;
      let splitFile = null;

      for (let i = 2; i < commandArgs.length; i++) {
        if (commandArgs[i] === '--spec-file' && commandArgs[i + 1]) {
          specFile = commandArgs[i + 1];
        }
        if (commandArgs[i] === '--split-issues' && commandArgs[i + 1]) {
          splitFile = commandArgs[i + 1];
        }
      }

      if (!specFile) {
        console.error('\x1b[31mError: Missing --spec-file parameter. Usage: node scripts/process-backlog.js update <issue-number> --spec-file <path>\x1b[0m');
        process.exit(1);
      }

      await updateIssue(issueNumber, specFile, splitFile);
    } else {
      console.error(`\x1b[31mError: Unknown command "${cmd}". Run "node scripts/process-backlog.js help" for details.\x1b[0m`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n\x1b[31m❌ Execution Error: ${err.message || err}\x1b[0m`);
    if (err.response) {
      console.error(JSON.stringify(err.response, null, 2));
    }
    process.exit(1);
  }
})();
