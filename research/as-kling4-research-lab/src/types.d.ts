export type Frame={uri:string;position:'first'|'middle'|'last'};
export type Kling4ImageRequest={model:'kling_4';promptImage:string|Frame[];duration?:number;ratio?:'auto_720p'|'auto_1080p';promptText?:string;references?:{uri:string}[]};
export type Task={id:string;status:'PENDING'|'THROTTLED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELED'|'CANCELLED';output?:string[];progress?:number;failure?:string;failureCode?:string;estimatedCost?:{credits:number}};
export type AuditEvent={at:string;elapsedMs:number;mode:'mock'|'live';clock:'simulated'|'wall';event:string;[key:string]:unknown};
