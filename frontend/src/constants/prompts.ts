export interface Prompt {
  id: string
  title: string
  description: string
  content: string
  category: string
  tags: string[]
  featured?: boolean
}

export const PROMPTS: Prompt[] = [
  {
    id: 'write-polish',
    title: '文章润色升级',
    description: '让语气更顺、结构更清晰，适合公众号、汇报和邮件。',
    content:
      '请你担任专业文字编辑。请在不改变核心观点的前提下，润色以下内容，使其表达更自然、逻辑更清晰、语气更专业。输出时请分为三部分：\n1. 润色后正文\n2. 关键修改说明\n3. 可继续优化的建议\n\n原文如下：\n[在此粘贴内容]',
    category: '写作',
    tags: ['润色', '公文', '表达'],
    featured: true,
  },
  {
    id: 'write-xiaohongshu',
    title: '小红书爆款文案',
    description: '适合种草、探店、经验分享，带标题和互动结尾。',
    content:
      '请帮我写一篇关于[主题]的小红书风格内容，要求：\n1. 先给出 3 个可选标题\n2. 正文口语化、有记忆点\n3. 分段清晰，适度使用 emoji\n4. 结尾加入互动提问和 5 个相关话题标签',
    category: '写作',
    tags: ['小红书', '种草', '营销'],
  },
  {
    id: 'write-video-script',
    title: '短视频口播脚本',
    description: '适合产品介绍、账号运营和引流转化。',
    content:
      '请围绕[主题]生成一份 60 秒短视频口播脚本，输出格式包含：\n1. 开场钩子\n2. 核心内容\n3. 节奏建议\n4. 结尾 CTA\n要求语言自然、适合真人出镜。',
    category: '写作',
    tags: ['短视频', '口播', '脚本'],
    featured: true,
  },
  {
    id: 'code-explain',
    title: '代码解释与梳理',
    description: '快速理解陌生代码，适合接手老项目。',
    content:
      '请你作为高级工程师，解释以下代码的作用、执行流程、关键依赖、边界情况和可优化点。请用尽量易懂的中文分点说明：\n\n[在此粘贴代码]',
    category: '编程',
    tags: ['代码解释', '重构', '排查'],
  },
  {
    id: 'code-debug',
    title: 'Bug 排查与修复',
    description: '定位错误原因，输出可执行修复方案。',
    content:
      '这段代码或报错日志存在问题，请按以下格式帮我排查：\n1. 问题根因\n2. 复现条件\n3. 修复方案\n4. 修复后的代码片段\n5. 后续预防建议\n\n代码/日志如下：\n[在此粘贴内容]',
    category: '编程',
    tags: ['调试', '报错', '修复'],
    featured: true,
  },
  {
    id: 'code-review',
    title: '代码评审助手',
    description: '重点看风险、回归、边界条件和测试缺口。',
    content:
      '请以严格的 Code Review 标准审查以下改动，优先指出：\n1. 逻辑 Bug\n2. 行为回归风险\n3. 性能或安全问题\n4. 缺失的测试\n5. 需要澄清的假设\n\n代码如下：\n[在此粘贴代码或 diff]',
    category: '编程',
    tags: ['Code Review', '测试', '风险'],
  },
  {
    id: 'office-weekly',
    title: '周报生成器',
    description: '把零散工作内容整理成可汇报的周报。',
    content:
      '请根据以下工作内容生成一份专业周报，包含：\n1. 本周完成事项\n2. 关键结果与数据\n3. 问题与风险\n4. 下周计划\n要求语言简洁、适合发给上级。\n\n工作内容：\n1. [事项 1]\n2. [事项 2]\n3. [事项 3]',
    category: '办公',
    tags: ['周报', '汇报', '职场'],
  },
  {
    id: 'office-ppt',
    title: 'PPT 大纲生成',
    description: '先把汇报逻辑搭好，再去做页面。',
    content:
      '请根据主题[主题]生成一份 PPT 大纲，要求：\n1. 总页数控制在 8-12 页\n2. 每页给出标题、核心信息和建议图表\n3. 适合向[对象]汇报\n4. 最后一页给出总结与行动项',
    category: '办公',
    tags: ['PPT', '汇报', '结构化'],
  },
  {
    id: 'office-meeting',
    title: '会议纪要整理',
    description: '把录音或笔记整理成可执行纪要。',
    content:
      '请将以下会议记录整理成专业纪要，输出结构：\n1. 会议主题\n2. 关键结论\n3. 待办事项（负责人 + 截止时间）\n4. 风险与依赖\n\n会议内容：\n[在此粘贴记录]',
    category: '办公',
    tags: ['会议', '纪要', '待办'],
  },
  {
    id: 'learn-teacher',
    title: '知识点讲解老师',
    description: '适合啃新概念，用类比和例子帮你理解。',
    content:
      '请把[知识点/概念]讲解给零基础学习者听。要求：\n1. 先用一句话解释它是什么\n2. 再用生活化类比说明\n3. 给出一个实际例子\n4. 最后总结容易搞错的地方',
    category: '学习',
    tags: ['学习', '解释', '入门'],
  },
  {
    id: 'learn-interview',
    title: '面试官模拟',
    description: '适合产品、运营、开发等岗位面试训练。',
    content:
      '我正在准备[职位]面试。请扮演专业面试官，按真实面试节奏向我提问。要求：\n1. 一次只问一个问题\n2. 我回答后再继续追问\n3. 必要时指出回答中的不足\n4. 最后给出总体评价',
    category: '学习',
    tags: ['面试', '模拟', '训练'],
    featured: true,
  },
  {
    id: 'learn-english',
    title: '英语口语陪练',
    description: '适合口语练习、纠错和继续追问。',
    content:
      "Please act as my English speaking coach. I will speak or type in English. You should reply in concise, natural English, correct my mistakes, explain the corrections briefly, and ask one follow-up question each round. Keep your response under 120 words.",
    category: '学习',
    tags: ['英语', '口语', '陪练'],
  },
  {
    id: 'role-product',
    title: '产品经理对话',
    description: '帮你梳理需求、方案、优先级和上线风险。',
    content:
      '请扮演资深产品经理。针对我接下来提出的需求，帮我从以下角度分析：\n1. 用户价值\n2. 需求边界\n3. 关键流程\n4. 风险点\n5. 优先级建议\n\n需求如下：\n[在此输入需求]',
    category: '角色扮演',
    tags: ['产品经理', '需求分析', '方案'],
  },
  {
    id: 'role-boss',
    title: '老板视角挑战',
    description: '从结果、成本和执行角度逼你把方案想实。',
    content:
      '请扮演一个非常关注结果和 ROI 的老板。针对我接下来给你的方案，从目标、成本、风险、资源、人效和落地难度几个角度连续追问我，直到方案足够清晰。',
    category: '角色扮演',
    tags: ['老板视角', '质询', '方案评审'],
  },
  {
    id: 'life-fitness',
    title: '一周健身计划',
    description: '根据目标和基础情况给出训练与饮食建议。',
    content:
      '我是一名[性别]，身高[cm]，体重[kg]，当前运动基础为[基础情况]，目标是[增肌/减脂/塑形]。请为我制定一份一周健身与饮食计划，并说明注意事项。',
    category: '生活',
    tags: ['健身', '饮食', '计划'],
  },
  {
    id: 'life-travel',
    title: '旅行规划师',
    description: '快速出行程，适合自由行和短途周末。',
    content:
      '请根据以下条件帮我制定旅行计划：\n1. 目的地：[城市]\n2. 天数：[天数]\n3. 预算：[预算]\n4. 偏好：[美食/拍照/亲子/深度游]\n输出包含每日行程、交通建议、预算分配和避坑提醒。',
    category: '生活',
    tags: ['旅行', '攻略', '预算'],
  },
  {
    id: 'biz-shop',
    title: '电商卖点提炼',
    description: '把产品特性整理成更能转化的卖点表达。',
    content:
      '请根据以下商品信息，提炼 5 个核心卖点，并输出：\n1. 主标题文案\n2. 详情页短文案\n3. 直播口播卖点\n4. 适合人群\n\n商品信息：\n[在此粘贴商品资料]',
    category: '营销',
    tags: ['电商', '卖点', '转化'],
  },
  {
    id: 'biz-private-domain',
    title: '私域跟进话术',
    description: '适合成交、复购、召回等场景。',
    content:
      '请为[业务场景]设计一组私域沟通话术，要求覆盖：\n1. 首次触达\n2. 需求确认\n3. 异议处理\n4. 成交推动\n5. 售后关怀\n语气要自然，不要像机器人。',
    category: '营销',
    tags: ['私域', '成交', '客服'],
  },
]

export const CATEGORIES = ['全部', ...Array.from(new Set(PROMPTS.map((prompt) => prompt.category)))]

export const PROMPT_CATEGORY_META: Record<string, {icon: string; desc: string; accent: string}> = {
  全部: {
    icon: 'Sparkles',
    desc: '全部场景模板',
    accent: 'from-indigo-500 via-violet-500 to-sky-500',
  },
  写作: {
    icon: 'PenTool',
    desc: '写文案、润色、脚本',
    accent: 'from-fuchsia-500 via-rose-500 to-orange-400',
  },
  编程: {
    icon: 'Code2',
    desc: '解释、排错、评审',
    accent: 'from-sky-500 via-cyan-500 to-emerald-400',
  },
  办公: {
    icon: 'BriefcaseBusiness',
    desc: '周报、纪要、PPT',
    accent: 'from-amber-500 via-orange-500 to-rose-500',
  },
  学习: {
    icon: 'GraduationCap',
    desc: '面试、学习、语言练习',
    accent: 'from-violet-500 via-indigo-500 to-blue-500',
  },
  角色扮演: {
    icon: 'Drama',
    desc: '模拟对话和场景演练',
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
  生活: {
    icon: 'HeartHandshake',
    desc: '旅行、健身、生活计划',
    accent: 'from-pink-500 via-rose-500 to-red-400',
  },
  营销: {
    icon: 'Megaphone',
    desc: '转化、私域、电商卖点',
    accent: 'from-orange-500 via-amber-500 to-yellow-400',
  },
}
