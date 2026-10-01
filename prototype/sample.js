(function () {
  var logic = (typeof window !== "undefined" && window.MediationLogic)
    ? window.MediationLogic
    : require("./logic.js");

  var CASE_TITLE = "邻里房屋漏水、墙体损坏";

  var laws = [
    { citation: "《中华人民共和国民法典》第236条", text: "妨害物权或者可能妨害物权的，权利人可以请求排除妨害或者消除危险。" },
    { citation: "《中华人民共和国民法典》第237条", text: "造成不动产或者动产毁损的，权利人可以依法请求修理、重作、更换或者恢复原状。" },
    { citation: "《中华人民共和国民法典》第288条", text: "不动产的相邻权利人应当按照有利生产、方便生活、团结互助、公平合理的原则，正确处理相邻关系。" },
    { citation: "《中华人民共和国民法典》第296条", text: "不动产权利人因用水、排水、通行、铺设管线等利用相邻不动产的，应当尽量避免对相邻的不动产权利人造成损害。" },
    { citation: "《中华人民共和国民法典》第1165条第1款", text: "行为人因过错侵害他人民事权益造成损害的，应当承担侵权责任。" },
    { citation: "《中华人民共和国民法典》第1184条", text: "侵害他人财产的，财产损失按照损失发生时的市场价格或者其他合理方式计算。" },
    { citation: "《中华人民共和国民法典》第179条", text: "恢复原状、赔偿损失可以单独或合并适用。" }
  ];

  var cases = [
    {
      title: "上海，上下楼卫生间渗漏",
      text: "楼下主张修复和财产损失共计3万元。鉴定意见认为楼上卫生间防水整体失效，并有水龙头持续漏水；卧室、卫生间受损部位修复工程造价19233元。二审维持赔偿该修复造价，鉴定费另计。来源：新民网2024-05-16报道。"
    },
    {
      title: "四川富顺，楼上露台积水渗至楼下",
      text: "楼下主张各项损失11660元。法院调解结果是：物业赔偿4000元供楼下自行修复受损部位，并对楼上露台重做防水、重新计算五年质保。该案责任主体包含物业，用来说明先止漏、再谈修复费用，最终修复金额可以明显低于最初主张。来源：四川法治报2026-05报道。"
    }
  ];

  var caseNote = "只修复受损部位时，公开材料中可见数千元的调解结果，也可见约1.9万元的鉴定修复造价。家具原价和误工宜分开处理。";

  var samples = {
    A: [
      "我家是义亭镇某小区二楼。楼上卫生间防水老化，从今年雨季开始往下渗，客厅吊顶和东侧墙面发霉、涂料脱落，靠墙的柜子也泡了。我要求楼上把防水重做，把我家吊顶和墙面恢复原状，柜子损失和我请假在家配合维修的误工也要赔。一共主张 18000 元。",
      "柜子是三年前买的，我可以不按原价，但误工我还是希望考虑。墙面发霉是这次漏水造成的，不是老裂缝。"
    ],
    B: [
      "漏水我承认，卫生间防水用了很多年，我愿意重做防水，也愿意把楼下墙面和吊顶的基础修复承担下来。但墙面以前就有裂缝，柜子旧了，误工我不认。我这边能接受的是 4000 元，把基础修复做掉。",
      "基础修复我可以再加一点材料费，误工仍然不接受。我最多再谈到 6000 元。"
    ]
  };

  function record(id, createdAt, sideA, sideB) {
    var normalizedA = logic.buildNormalized("A", [{ text: sideA }]);
    var normalizedB = logic.buildNormalized("B", [{ text: sideB }]);
    var advice = logic.buildAdvice(normalizedA, normalizedB);
    return {
      id: id,
      createdAt: createdAt,
      caseTitle: CASE_TITLE,
      partyA: {
        name: "甲方",
        normalized: normalizedA,
        amount: logic.parseAmount(normalizedA)
      },
      partyB: {
        name: "乙方",
        normalized: normalizedB,
        amount: logic.parseAmount(normalizedB)
      },
      suggestion: advice.suggestion,
      suggestedAmount: advice.suggestedAmount,
      laws: laws,
      cases: cases,
      caseNote: caseNote
    };
  }

  var seeds = [
    record(
      "seed-20260612",
      "2026-06-12T14:20:00+08:00",
      "厨房水管渗到楼下吊顶，吊顶开裂。我要求修复吊顶。一共主张 9600 元。",
      "我愿意修复吊顶。能接受的是 3000 元。"
    ),
    record(
      "seed-20260703",
      "2026-07-03T09:40:00+08:00",
      "卫生间防水老化，楼下墙面和吊顶发霉。我要求修复墙面和吊顶。一共主张 15000 元。",
      "我愿意重做防水，也愿意修复墙面和吊顶。能接受的是 8000 元。"
    ),
    record(
      "seed-20260819",
      "2026-08-19T16:05:00+08:00",
      "卧室和卫生间墙面受损，家具原价也要赔。我要求修复墙面并赔偿家具。一共主张 22000 元。",
      "墙面我愿意修复。能接受的是 5000 元。"
    )
  ];

  var renovation = {
    id: "renovation",
    label: "装修纠纷",
    advise: "repair",
    caseTitle: CASE_TITLE,
    laws: laws,
    cases: cases,
    caseNote: caseNote,
    samples: samples
  };

  var hallway = {
    id: "hallway",
    label: "楼道堆物",
    advise: "hallway",
    caseTitle: "楼道堆物阻碍通行",
    laws: [
      { citation: "《中华人民共和国民法典》第288条", text: "不动产的相邻权利人应当按照有利生产、方便生活、团结互助、公平合理的原则，正确处理相邻关系。" },
      { citation: "《中华人民共和国民法典》第286条第2款", text: "业主大会或者业主委员会，对任意弃置垃圾、排放污染物或者噪声、违反规定饲养动物、违章搭建、侵占通道、拒付物业费等损害他人合法权益的行为，有权依照法律、法规以及管理规约，请求行为人停止侵害、排除妨碍、消除危险、恢复原状、赔偿损失。" },
      { citation: "《中华人民共和国消防法》第28条", text: "任何单位、个人不得损坏、挪用或者擅自拆除、停用消防设施、器材，不得埋压、圈占、遮挡消火栓或者占用防火间距，不得占用、堵塞、封闭疏散通道、安全出口、消防车通道。人员密集场所的门窗不得设置影响逃生和灭火救援的障碍物。" }
    ],
    cases: [
      {
        title: "邻居在消防通道堆放儿童车和纸箱",
        text: "自房屋交付后，一方在公共消防通道摆放儿童车、纸箱。居委会、物业和消防部门协调后，东西仍被搬回。法院组织调解，结果是及时清空杂物，并保持所住楼层消防通道下行方向畅通，不得再堆放影响通行。来源：澎湃新闻《社区楼道堆物问题整治工作指引》摘编。"
      },
      {
        title: "上海杨浦，楼道停放电动车并飞线充电",
        text: "老旧小区楼道长期停放助动车，并从楼上私拉电线充电，疏散通道被占。街道会同居委会、物业现场清理车辆、剪除飞线，并劝导居民改到集中停放处。报道未见双方约定赔偿金额。来源：上海市杨浦区人民政府网站，2026年5月12日。"
      }
    ],
    caseNote: "楼道堆物的公开处理，常见结果是限期把电动车、柜子、纸箱移出疏散通道，并约定以后不再堆放，而不是先算一笔赔偿。",
    samples: {
      A: [
        "我住义亭镇某小区3单元。对门把旧柜子、一摞纸箱，还有一辆电动车放在楼道里。我晚上回来要侧着身走，消火栓也被纸箱挡住了。我找他说了两次，他说家里还没收拾完。我的要求是这周把楼道让出来，电动车不要再推进楼。我不要赔偿。",
        "电动车今天推下去，这个我认。柜子不要拖过这个周日，纸箱给你三天。清完以后，大件别再放楼道过夜。鞋靠墙放一双可以，别再堆箱子。"
      ],
      B: [
        "东西是我的。楼道现在挡了路，这个我承认，消火栓也不该被纸箱挡住。家里老人前两天刚从医院回来，柜子是临时腾出来的。电动车是楼下充电桩这几天满了，我才推上来，不是想长期占着。电动车我今天就推下去，柜子给我到这个周日，纸箱我三天内收完。",
        "电动车今天推到楼下集中停放的地方，以后不在楼道充电。柜子这个周日之前搬走。纸箱三天内收掉。以后大件不在楼道过夜。"
      ]
    }
  };

  var api = {
    scenarios: [hallway, renovation],
    caseTitle: CASE_TITLE,
    laws: laws,
    cases: cases,
    caseNote: caseNote,
    samples: samples,
    seeds: seeds
  };

  if (typeof window !== "undefined") window.PrototypeData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
