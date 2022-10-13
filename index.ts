import { UserService } from "./src/user-service";

UserService.deduplicateUserCsv('data.csv');
UserService.getUserLoginsCsv('data.csv', '2021-03-11 13:13:03 +0800', '2021-08-03 16:58:12 +0800');