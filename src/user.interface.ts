export interface UserDictionary {
    [key: string]: User;
}

export interface User {
    'Email': string;
    'Name': string;
    'Last Login': Date;
    'Workspace': string;
    'Role': string;
}