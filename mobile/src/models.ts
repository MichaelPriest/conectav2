export type Profile={id:string;handle:string;display_name:string;bio:string|null;avatar_path:string|null};
export type AgeAccess='ok'|'onboarding'|'age-check';
export type Post={
 id:string;author_id:string;community_id:string|null;content:string;visibility:string;
 moderation_status:'approved'|'pending'|'rejected';created_at:string;
 media_path:string|null;media_type:string|null;
 profiles:{display_name:string;handle:string;avatar_path:string|null}|null;
 post_likes:{count:number}[];post_comments:{count:number}[];
 post_media:{storage_path:string;media_type:string;position:number}[];
};
export type Friendship={id:string;requester_id:string;addressee_id:string;status:string;created_at:string};
export type Community={id:string;slug:string;name:string;description:string;cover_path:string|null;avatar_path:string|null;is_official:boolean};
export type Notice={id:string;kind:string;created_at:string;read_at:string|null;entity_id:string|null;profiles:{display_name:string;handle:string}|null};
export type Thread={id:string;title:string;group:boolean;other:Profile|null;unread:number;last:string;updated:string};
export type ChatMessage={id:string;conversation_id:string;sender_id:string;content:string;created_at:string;media_path:string|null;media_type:string|null;deleted_at:string|null};
