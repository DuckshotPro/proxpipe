/**
 * status-sync.js
 * Updates a GitHub Projects V2 item status via GraphQL.
 * Used at the end of the pipeline to close the loop (move item to 'Done').
 *
 * Required env vars:
 *   GITHUB_TOKEN, GITHUB_PROJECT_ID, STATUS_FIELD_ID, STATUS_DONE_VALUE
 */

const GH_GRAPHQL = 'https://api.github.com/graphql';

function getToken() {
  return process.env.GITHUB_TOKEN;
}

/**
 * Move a project item to a new status
 */
export async function updateProjectItemStatus(itemId, statusOptionId) {
  const token = getToken();
  const projectId = process.env.GITHUB_PROJECT_ID;
  const fieldId = process.env.STATUS_FIELD_ID;

  const mutation = `
    mutation UpdateStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: $value
        }
      ) { projectV2Item { id } }
    }
  `;

  const res = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        projectId,
        itemId,
        fieldId,
        value: { singleSelectOptionId: statusOptionId }
      }
    })
  });

  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data;
}

/**
 * Move item to Done — call this after PR is merged
 */
export async function markItemDone(itemId) {
  return updateProjectItemStatus(itemId, process.env.STATUS_DONE_VALUE);
}

/**
 * Get project field IDs — run this once to populate your .env
 * Usage: node -e "import('./pipelines/github-projects/status-sync.js').then(m => m.getProjectFields())"
 */
export async function getProjectFields() {
  const token = getToken();
  const projectId = process.env.GITHUB_PROJECT_ID;

  const query = `
    query GetFields($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { projectId } })
  });

  const data = await res.json();
  console.log(JSON.stringify(data?.data?.node?.fields?.nodes, null, 2));
  return data;
}
