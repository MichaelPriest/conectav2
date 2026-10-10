/** Deterministic Story playback order: one user bubble, then every Story
 * from that user, followed by the next user's group. */
export type StorySequenceItem={
 id:string;author_id:string;created_at:string;expires_at:string;
};
export function groupedStorySequence<T extends StorySequenceItem>(
 stories:T[],viewerId:string,now=Date.now()
):{owners:string[];timeline:T[];bubbles:T[]}{
 const groups=new Map<string,T[]>();
 // Supabase returns latest first. Preserve that author order, with own group
 // first, but play each person's older unexpired Stories before newer ones.
 for(const story of stories){
  if(!Number.isFinite(Date.parse(story.expires_at))||
    Date.parse(story.expires_at)<=now)continue;
  const group=groups.get(story.author_id)||[];
  group.push(story);
  groups.set(story.author_id,group);
 }
 const owners=[...groups.keys()];
 if(owners.includes(viewerId)){
  owners.splice(owners.indexOf(viewerId),1);
  owners.unshift(viewerId);
 }
 const timeline=owners.flatMap(owner=>
  (groups.get(owner)||[]).sort((a,b)=>a.created_at.localeCompare(b.created_at)));
 return {owners,timeline,bubbles:owners.flatMap(owner=>{
  const first=timeline.find(story=>story.author_id===owner);
  return first?[first]:[];
 })};
}
export function firstUnseenStory<T extends StorySequenceItem>(
 timeline:T[],authorId:string,seen:ReadonlySet<string>
):T|undefined{
 const group=timeline.filter(story=>story.author_id===authorId);
 return group.find(story=>!seen.has(story.id))||group[0];
}
export function nextStoryInSequence<T extends StorySequenceItem>(
 timeline:T[],currentId:string,direction:1|-1
):T|undefined{
 const index=timeline.findIndex(story=>story.id===currentId);
 return index>=0?timeline[index+direction]:undefined;
}
