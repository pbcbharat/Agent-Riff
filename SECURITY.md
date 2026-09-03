# Security policy

## Supported version

The latest revision on the default branch is supported during the WebMCP Challenge judging period.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could put users at risk. Contact the repository owner privately with:

- the affected page or tool;
- steps to reproduce the issue;
- the impact you observed; and
- a suggested mitigation, if you have one.

Please do not include real credentials, private performance data, or personal information in a report.

## Security model

TuneIn is local-first and does not collect accounts or personal data. WebMCP tools expose only the current page session's musical state. State-changing tools use bounded schemas and runtime validation. The app does not request microphone, camera, location, or file permissions.
