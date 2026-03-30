// routes/session.routes.ts

import { Router } from "express"
import * as controller from "../controllers/session.controller"

const router = Router()

router.post("/", controller.create)
router.get("/", controller.list)

export default router