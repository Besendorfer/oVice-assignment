import { createReadStream, createWriteStream } from 'fs';
import { from } from 'rxjs';
import { filter, reduce, toArray } from 'rxjs/operators';
import { parse } from '@fast-csv/parse';
import { format } from '@fast-csv/format';
import * as cleanTextUtils from 'clean-text-utils';

import type { UserDictionary, User } from './user.interface';
import type { Observable } from 'rxjs';

export abstract class UserService {
    public static deduplicateUserCsv (source: string): void {
        const csvStream$ = this.setupCsvReadStream(source);

        csvStream$.pipe(
            reduce((accumulator: UserDictionary, value: User) => {
                let returnValue: UserDictionary = { ...accumulator };
                const identifier: string = this.getCorrectIdentifier(value);

                // break early when a row has no useful identifier (no email or name)
                if (identifier === '') return returnValue;

                if (!(identifier in returnValue)) {
                    returnValue[identifier] = value;
                }
                else {
                    returnValue[identifier] = this.deduplicate(returnValue[identifier], value);
                }
                
                return returnValue;
            }, {} as UserDictionary)
        )
        .subscribe((result: UserDictionary) => {
            const writeStream = this.setupCsvWriteStream('deduplicated-data.csv');

            Object.entries(result).forEach(([_key, value]: [string, User]) => {
                writeStream.write([value.Name, value.Email, value['Last Login'], value.Workspace, value.Role]);
            });
            writeStream.end();
        });
    }

    public static getUserLoginsCsv (source: string, from: string, to: string): void {
        const csvStream$ = this.setupCsvReadStream(source);
        const fromDate: number = new Date(from).getTime();
        const toDate: number = new Date(to).getTime();

        csvStream$.pipe(
            filter((value: User) => {
                const valueDate: number = new Date(value['Last Login']).getTime();
                return valueDate >= fromDate && valueDate <= toDate;
            }),
            toArray()
        ).subscribe((result: User[]) => {
            const writeStream = this.setupCsvWriteStream('user-logins-data.csv');

            result.forEach((value: User) => {
                writeStream.write([value.Name, value.Email, value['Last Login'], value.Workspace, value.Role]);
            });
            writeStream.end();
        });
    }

    private static setupCsvReadStream (source: string): Observable<User> {
        // initialize connection to the CSV
        const rs = createReadStream(source);
        const csvStream = rs.pipe(parse({ headers: true }));
        return from(csvStream); // utilize the Observable pattern
    }

    private static setupCsvWriteStream (source: string) {
        const stream = format({ headers: ['Name', 'Email', 'Last Login', 'Workspace', 'Role'] });
        const ws = createWriteStream(source);
        stream.pipe(ws);
        return stream;
    }

    private static deduplicate (mappedUser: User, value: User): User {
        const mappedDatetime: number = new Date(mappedUser['Last Login']).getTime();
        const valueDatetime: number = new Date(value['Last Login']).getTime();

        if (valueDatetime > mappedDatetime) {
            mappedUser['Last Login'] = value['Last Login'];
            mappedUser.Workspace = value.Workspace;
            mappedUser.Role = value.Role;
        }

        // Native preferred name / ascii name
        if (!this.isStringAscii(value.Name, true)) {
            mappedUser.Name = cleanTextUtils.replace.exoticChars(value.Name);
        }
        else if (this.isStringAscii(value.Name, true) && 
                !this.isStringAscii(value.Name) &&
                 this.isStringAscii(mappedUser.Name)) {
            mappedUser.Name = value.Name;
        }

        return mappedUser;
    }

    private static getCorrectIdentifier (value: User): string {
        let mapIndex: string = value.Email.toLocaleLowerCase();
                
        if(value.Email === '' && value.Name !== '') {
            // use name as the distiguishing value.
            mapIndex = value.Name.toLocaleLowerCase();
        }

        return mapIndex;
    }

    private static isStringAscii (value: string, extended: boolean = false): boolean {
        // extended character set has diacritics, which shouldn't be filtered out in some cases
        // https://www.ascii-code.com/
        const charSet = extended ? 255 : 127;
        return [...value].every(char => char.charCodeAt(0) <= charSet);
    }
}