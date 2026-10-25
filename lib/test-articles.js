// Demo test articles for the optional "Load test article" buttons (see NEXT_PUBLIC_SHOW_TEST_BUTTON).
// Headlines start with "SMOKE TEST" so the instances can be found and deleted in Operate.
// Word count must stay within the Supabase thresholds (min 150, max 1200).
// CLEAN_BODY must contain none of the banned terms in demo_publisher_banned_words
// (guaranteed, miracle cure, shocking, you won't believe). The DMN matches substrings, so avoid partial matches too.

export const CLEAN_HEADLINE = 'SMOKE TEST - PoC clean article';
export const REVISION_HEADLINE = 'SMOKE TEST - PoC revision article';

export const CLEAN_BODY = `The city council voted on Tuesday to approve a new cycling network that will connect the inner suburbs to the central business district over the next three years. The plan includes eleven kilometres of separated bike lanes, improved lighting along existing paths and secure parking at six train stations. Council officers said the first stage, a four kilometre route beside the river, will begin construction in March and is expected to finish before the end of winter.

Supporters told the meeting that safer routes would encourage more residents to ride to work and school, easing pressure on local roads. Several business owners welcomed the proposal, saying more foot and bike traffic could help small shops on the main streets. Some residents raised concerns about the loss of around forty street parking spaces, and the council agreed to review the impact after the first year.

The project will cost an estimated nine million dollars, shared between the council and the state government. A public information session will be held next month, and drawings for each stage will be published on the council website. Feedback from the community will be considered before final designs are confirmed.`;

// Same article with exactly one banned term ("guaranteed") added, so the DMN rules fail it and the revision path runs.
export const REVISION_BODY = CLEAN_BODY.replace(
  'Several business owners welcomed the proposal,',
  'One councillor said the network would deliver guaranteed savings for every household that switches to cycling. Several business owners welcomed the proposal,'
);
