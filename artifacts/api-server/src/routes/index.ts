import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vmsRouter from "./vms";
import disksRouter from "./disks";
import qemuRouter from "./qemu";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/vms", vmsRouter);
router.use("/disks", disksRouter);
router.use("/qemu", qemuRouter);

export default router;
