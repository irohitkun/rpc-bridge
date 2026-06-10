import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nowPlayingRouter from "./now-playing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nowPlayingRouter);

export default router;
