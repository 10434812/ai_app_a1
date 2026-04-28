import { Router } from 'express';
import { SystemConfig } from "../models/SystemConfig.js";
import { getDisabledModelIds } from "../services/modelStatusService.js";
import { getPublicModelStatusMap } from "../services/modelCatalogService.js";
const router = Router();
router.get('/', async (req, res) => {
    try {
        const [configs, disabledModelIds, modelStatusMap] = await Promise.all([
            SystemConfig.findAll({
                where: {
                    key: ['guest_trial_limit', 'multi_model_trial_limit', 'WECHAT_APP_ID', 'WECHAT_SHARE_TITLE', 'WECHAT_SHARE_DESC', 'WECHAT_SHARE_IMG', 'WECHAT_SHARE_LINK'],
                },
            }),
            getDisabledModelIds(),
            getPublicModelStatusMap(),
        ]);
        const configMap = configs.reduce((acc, cur) => {
            acc[cur.key] = cur.value;
            return acc;
        }, {});
        const guestLimit = configMap['guest_trial_limit'] ? parseInt(configMap['guest_trial_limit'], 10) : 100;
        const multiModelLimit = configMap['multi_model_trial_limit'] ? parseInt(configMap['multi_model_trial_limit'], 10) : 5;
        const wechatAppId = configMap['WECHAT_APP_ID'] || process.env.WECHAT_APP_ID || '';
        res.json({
            guest_trial_limit: guestLimit,
            multi_model_trial_limit: multiModelLimit,
            wechat_app_id: wechatAppId,
            wechat_share_title: configMap['WECHAT_SHARE_TITLE'] || '',
            wechat_share_desc: configMap['WECHAT_SHARE_DESC'] || '',
            wechat_share_img: configMap['WECHAT_SHARE_IMG'] || '',
            wechat_share_link: configMap['WECHAT_SHARE_LINK'] || '',
            disabled_model_ids: disabledModelIds,
            model_status_map: modelStatusMap,
        });
    }
    catch (error) {
        console.error('Fetch public config error:', error);
        // Fallback default
        res.json({
            guest_trial_limit: 101,
            multi_model_trial_limit: 5,
            wechat_app_id: '',
            wechat_share_title: '',
            wechat_share_desc: '',
            wechat_share_img: '',
            disabled_model_ids: [],
            model_status_map: {},
        });
    }
});
export const configRouter = router;
