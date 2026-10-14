(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.MediationLogic = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  var AMOUNT_RE = /(\d+(?:\.\d+)?)\s*万元|(\d+(?:\.\d+)?)\s*万(?!元)|(\d+(?:\.\d+)?)\s*元/g;
  var REQUEST_RE = /要求|主张|希望|愿意|接受|赔偿|赔|修复|重做/;
  var WALL_RE = /墙面|墙体|涂料/;
  var CEIL_RE = /吊顶|天花板/;

  function parseAmount(text) {
    if (!text) return null;
    AMOUNT_RE.lastIndex = 0;
    var last = null;
    var match;
    while ((match = AMOUNT_RE.exec(text))) {
      if (match[1] != null) last = Math.round(parseFloat(match[1]) * 10000);
      else if (match[2] != null) last = Math.round(parseFloat(match[2]) * 10000);
      else last = Math.round(parseFloat(match[3]));
    }
    return last;
  }

  function amountLabel(amount) {
    return amount == null ? "未明确" : amount + "元";
  }

  function partyTitle(side) {
    return side === "A" ? "申请人" : "被申请人";
  }

  function requestLines(rounds) {
    var lines = [];
    rounds.forEach(function (round) {
      String(round).split(/[。！？\n]+/).forEach(function (part) {
        var sentence = part.trim();
        if (sentence && REQUEST_RE.test(sentence)) lines.push(sentence);
      });
    });
    return lines;
  }

  function buildNormalized(side, rounds) {
    var texts = (rounds || []).map(function (round) {
      return String(round && round.text != null ? round.text : round).trim();
    }).filter(Boolean);
    var facts = texts.map(function (text, index) {
      return (index + 1) + ". " + text;
    }).join("\n");
    var amount = parseAmount(texts.join("\n"));
    var requests = requestLines(texts);
    return [
      partyTitle(side) + "的诉求如下。",
      "",
      "事实经过：",
      facts,
      "",
      "主张金额：" + amountLabel(amount) + "。",
      "",
      "请求事项：",
      requests.length ? requests.join("\n") : "见上述事实经过。"
    ].join("\n");
  }

  function detectScope(text) {
    var wall = WALL_RE.test(text);
    var ceiling = CEIL_RE.test(text);
    var surface = wall || ceiling;
    if (/卧室/.test(text) && /卫生间/.test(text) && surface) {
      return { tier: "多房间受损", scopeText: "卧室与卫生间等多处受损" };
    }
    if (wall && ceiling) {
      return { tier: "墙面加吊顶", scopeText: "墙面、吊顶" };
    }
    if (wall || ceiling) {
      return { tier: "单一饰面", scopeText: wall && !ceiling ? "墙面" : "吊顶" };
    }
    return { tier: null, scopeText: "受损部位尚未具体到墙面、吊顶或多个房间" };
  }

  function mentionedFees(text) {
    var items = [];
    if (/修复|重做|恢复/.test(text)) items.push("修复");
    if (/家具|柜子|家电/.test(text)) items.push("家具或柜子");
    if (/误工/.test(text)) items.push("误工");
    if (!items.length) return "陈述未提及修复、家具或柜子、误工。";
    return "陈述提及" + items.join("、") + "。";
  }

  function claimLine(amountA, amountB) {
    if (amountA != null && amountB != null) {
      return "申请人主张" + amountA + "元，被申请人主张" + amountB + "元，差额" + Math.abs(amountA - amountB) + "元。";
    }
    if (amountA != null) return "申请人主张" + amountA + "元，被申请人主张未明确。";
    if (amountB != null) return "申请人主张未明确，被申请人主张" + amountB + "元。";
    return "双方主张均未明确。";
  }

  function buildAdvice(textA, textB) {
    var left = textA || "";
    var right = textB || "";
    var combined = left + "\n" + right;
    var amountA = parseAmount(left);
    var amountB = parseAmount(right);
    var scope = detectScope(combined);
    var furniture = /家具|柜子|家电/.test(combined);
    var wage = /误工/.test(combined);
    var lines = [];

    var admitted = [];
    if (/承认/.test(left)) admitted.push("申请人");
    if (/承认/.test(right)) admitted.push("被申请人");
    lines.push("争议焦点");
    lines.push("漏水原因：" + (admitted.length
      ? admitted.join("、") + "已承认漏水。"
      : "尚未有一方明确承认漏水，建议先共同确认漏水点。"));
    lines.push("损害范围：" + scope.scopeText + "。");
    lines.push("费用项目：申请人主张" + amountLabel(amountA) + "，被申请人主张" + amountLabel(amountB) + "。" + mentionedFees(combined));
    lines.push("");
    lines.push("责任与履行");
    lines.push("1. 双方于3日内共同查看并确认漏水点。");
    lines.push("2. 漏水源头所在一方于15日内重做防水，先止住漏水。");
    lines.push("3. 受损一方配合进场，移开靠墙物品。防水完成并干燥后，再恢复受损饰面。");
    lines.push("4. 双方验收合格后，按确认的范围和修复方式协商费用。");
    lines.push("");
    lines.push("分项处理");
    if (scope.tier == null) {
      lines.push("饰面修复：请补清受损的是墙面、吊顶，还是卧室与卫生间等多处。范围确认后，再确定是局部修补还是整面恢复。");
    } else {
      lines.push("饰面修复：受损范围为" + scope.scopeText + "。先确认是局部修补还是整面恢复，再由责任方安排施工。");
    }
    lines.push(furniture
      ? "家具、柜子：不按购买原价折算，按损失发生时的市场价格，由双方另行协商。"
      : "家具、柜子：双方陈述未提及家具损失，本次不列。");
    lines.push(wage
      ? "误工：如需主张，另行提供请假和收入依据后协商。"
      : "误工：双方陈述未提及误工，本次不列。");
    lines.push("");
    lines.push("协商安排");
    lines.push(claimLine(amountA, amountB));
    lines.push("双方主张作为协商起点。修复费用在确认受损范围和修复方式后，由双方协商、调解员主持把握。");

    return {
      suggestion: lines.join("\n"),
      suggestedAmount: null,
      headline: scope.tier == null
        ? "先确认漏水点和受损范围，再安排修复"
        : "先止漏并恢复受损部位，费用按确认范围协商"
    };
  }

  function buildHallwayAdvice(textA, textB) {
    var left = textA || "";
    var right = textB || "";
    var admitted = [];
    if (/承认/.test(left)) admitted.push("申请人");
    if (/承认/.test(right)) admitted.push("被申请人");
    var lines = [];
    lines.push("争议焦点");
    lines.push("堆放情况：" + (admitted.length
      ? admitted.join("、") + "已承认楼道里的东西挡住了通行。"
      : "尚未有一方明确承认楼道堆物影响通行，建议先到现场看一遍。"));
    lines.push("要分开的是三件事：电动车何时推出楼道，柜子和纸箱哪一天清完，以后大件还能不能放在楼道过夜。");
    lines.push("双方要求的是把楼道让出来，不是先算一笔赔偿。");
    lines.push("");
    lines.push("责任与履行");
    lines.push("1. 放置物品的一方于当天把电动车推到小区集中停放处，以后不在楼道充电。");
    lines.push("2. 柜子于本周日之前搬走，纸箱于3日内收完。这是行为义务。");
    lines.push("3. 清出后不得再堆放柜子、纸箱，不得遮挡消火栓，不得挡住正常通行。");
    lines.push("4. 靠墙临时放一双鞋可以。大件不再在楼道过夜。");
    lines.push("5. 清完当天，双方一起看楼道。仍未清出的，由村社或物业继续督促。");
    lines.push("");
    lines.push("分项处理");
    lines.push("电动车：当天移出楼道，改停集中停放处。");
    lines.push("柜子：不晚于本周日搬走。");
    lines.push("纸箱：3日内收完。");
    lines.push("以后：大件不在楼道过夜，不遮挡消火栓。");
    lines.push("");
    lines.push("处理结果");
    lines.push("本案按排除妨碍处理：限期把电动车、柜子、纸箱移出楼道，恢复通行。");
    lines.push("以后如果因为堆物造成实际损失，另行提供依据再议。");
    return {
      suggestion: lines.join("\n"),
      suggestedAmount: null,
      headline: "限期清出楼道，恢复通行"
    };
  }

  return {
    parseAmount: parseAmount,
    buildNormalized: buildNormalized,
    buildAdvice: buildAdvice,
    buildHallwayAdvice: buildHallwayAdvice
  };
});
