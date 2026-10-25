// Simulated writers for the demo. Journalists do not log into Camunda: in production the portal or CMS would authenticate
// them and pass their identity along. Here the Submit form lets you pick who is "writing", so the process, the notifications
// and the audit variables carry different people. All names and addresses are fictional.
export const WRITERS = [
  { id: 'alex', name: 'Alex Rivera', desk: 'National', email: 'alex.rivera@writers.example.invalid' },
  { id: 'sam', name: 'Sam Okafor', desk: 'Sport', email: 'sam.okafor@writers.example.invalid' },
  { id: 'priya', name: 'Priya Nair', desk: 'Finance', email: 'priya.nair@writers.example.invalid' },
  { id: 'jordan', name: 'Jordan Lee', desk: 'Lifestyle', email: 'jordan.lee@writers.example.invalid' },
];

export const writerLabel = (w) => `${w.name} (${w.desk})`;
