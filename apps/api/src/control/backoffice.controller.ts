import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { InternalDevAuthGuard, type HeaderRequest } from "../auth/dev-auth.js";
import { BackofficeService } from "./backoffice.service.js";
@Controller("v1/control/backoffice")
@UseGuards(InternalDevAuthGuard)
export class BackofficeController{
  constructor(@Inject(BackofficeService)private readonly service:BackofficeService){}
  @Get("dashboard")dashboard(@Req()req:HeaderRequest,@Query("range")range?:string,@Query("from")from?:string,@Query("to")to?:string){return this.service.dashboard(req,{range,from,to})}
  @Get("notifications")notifications(@Req()req:HeaderRequest){return this.service.notifications(req)}
  @Get("search")search(@Req()req:HeaderRequest,@Query("q")q=""){return this.service.search(req,q)}
}
