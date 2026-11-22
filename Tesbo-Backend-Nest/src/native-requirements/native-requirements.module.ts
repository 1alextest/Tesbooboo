import { Module } from "@nestjs/common";
import { LegacyModule } from "../legacy/legacy.module";
import { NativeRequirementsController } from "./native-requirements.controller";

@Module({ imports: [LegacyModule], controllers: [NativeRequirementsController] })
export class NativeRequirementsModule {}
