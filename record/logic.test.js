const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAmount, buildNormalized, buildAdvice, buildHallwayAdvice } = require("./logic.js");
const data = require("./sample.js");

test("parses yuan, wan, and wan-yuan, keeping the last amount", function () {
  assert.equal(parseAmount("一共 18000元"), 18000);
  assert.equal(parseAmount("主张 1.8万元"), 18000);
  assert.equal(parseAmount("主张 1.8万"), 18000);
  assert.equal(parseAmount("先说 4000 元，后来主张 18000 元"), 18000);
  assert.equal(parseAmount("这里没有金额"), null);
  assert.equal(parseAmount("纯数字 18000 不算"), null);
});

test("normalized text keeps original rounds, title, amount, and requests", function () {
  const text = buildNormalized("A", [
    { text: "客厅吊顶渗水。" },
    { text: "我要求恢复墙面。一共主张 18000 元。" }
  ]);
  assert.match(text, /申请人的诉求如下/);
  assert.doesNotMatch(text, /楼下住户|楼上住户/);
  assert.match(text, /1\. 客厅吊顶渗水。/);
  assert.match(text, /2\. 我要求恢复墙面。一共主张 18000 元。/);
  assert.match(text, /主张金额：18000元。/);
  assert.match(text, /我要求恢复墙面/);
  assert.doesNotMatch(text, /请求事项：\n客厅吊顶渗水/);

  const unnamed = buildNormalized("B", [{ text: "楼上漏了水。" }]);
  assert.match(unnamed, /被申请人的诉求如下/);
  assert.doesNotMatch(unnamed, /楼下住户|楼上住户/);
  assert.match(unnamed, /主张金额：未明确。/);
  assert.match(unnamed, /见上述事实经过。/);
});

function refusesSuggestedFigure(advice) {
  assert.equal(advice.suggestedAmount, null);
  assert.doesNotMatch(advice.headline + advice.suggestion, /不提出具体金额|不报修复金|不展示具体/);
  assert.doesNotMatch(advice.suggestion, /建议修复金\s*\d+/);
  assert.doesNotMatch(advice.suggestion, /建议金额\s*\d+/);
  assert.doesNotMatch(advice.suggestion, /6000元|10000元|15000元/);
}

test("repair advice records claims but does not propose a figure", function () {
  const advice = buildAdvice(
    "客厅吊顶和东侧墙面发霉，柜子泡了，误工也要赔。主张 18000 元。",
    "漏水我承认。我愿意修复墙面和吊顶。能接受的是 4000 元。"
  );
  refusesSuggestedFigure(advice);
  assert.match(advice.suggestion, /争议焦点/);
  assert.match(advice.suggestion, /责任与履行/);
  assert.match(advice.suggestion, /分项处理/);
  assert.match(advice.suggestion, /协商安排/);
  assert.match(advice.headline, /先止漏并恢复受损部位/);
  assert.match(advice.suggestion, /差额14000元/);
  assert.match(advice.suggestion, /申请人主张18000元/);
  assert.match(advice.suggestion, /不按购买原价折算/);
  assert.match(advice.suggestion, /被申请人已承认漏水/);
  assert.match(advice.suggestion, /受损范围为墙面、吊顶/);
  assert.doesNotMatch(advice.suggestion, /楼下住户|楼上住户|楼上已承认|楼上于15日|楼下配合/);
});

test("different claims still do not produce a suggested figure", function () {
  const advice = buildAdvice(
    "客厅吊顶和墙面发霉。主张 18000 元。",
    "愿意修复吊顶和墙面。能接受的是 6500 元。"
  );
  refusesSuggestedFigure(advice);
  assert.match(advice.suggestion, /被申请人主张6500元/);
});

test("scope is described without a repair figure", function () {
  refusesSuggestedFigure(buildAdvice("楼下吊顶坏了。主张 9600 元。", "接受 3000 元。"));
  const rooms = buildAdvice("卧室和卫生间墙面受损。主张 22000 元。", "接受 5000 元。");
  refusesSuggestedFigure(rooms);
  assert.match(rooms.suggestion, /卧室与卫生间等多处受损/);
  const unclear = buildAdvice("水管有问题。主张 1000 元。", "接受 200 元。");
  refusesSuggestedFigure(unclear);
  assert.match(unclear.suggestion, /请补清受损的是墙面、吊顶/);
});

test("incomplete claims still do not produce a figure", function () {
  refusesSuggestedFigure(buildAdvice("墙面和吊顶都坏了。主张 18000 元。", "愿意修复墙面和吊顶。"));
  refusesSuggestedFigure(buildAdvice("墙面和吊顶都坏了。", "愿意看看墙面和吊顶。"));
});

test("preset history does not store a suggested figure", function () {
  assert.deepEqual(data.seeds.map(function (seed) { return seed.suggestedAmount; }), [null, null, null]);
  data.seeds.forEach(function (seed) {
    assert.match(seed.suggestion, /争议焦点/);
    assert.doesNotMatch(seed.suggestion, /不提出具体金额/);
    assert.doesNotMatch(seed.suggestion, /建议修复金\s*\d+/);
    assert.equal(seed.laws.some(function (law) { return /对应关系|对本案/.test(law.citation + law.text); }), false);
  });
  assert.match(data.seeds[2].suggestion, /不按购买原价折算/);
  assert.equal(data.seeds[0].partyA.amount, 9600);
  assert.equal(data.seeds[1].partyB.amount, 8000);
});

test("hallway example stays off specific amounts", function () {
  const hallway = data.scenarios.find(function (item) { return item.id === "hallway"; });
  const spoken = hallway.samples.A.concat(hallway.samples.B).join("\n");
  assert.equal(parseAmount(spoken), null);
  assert.doesNotMatch(spoken, /噪声|噪音/);
  const advice = buildHallwayAdvice(
    buildNormalized("A", hallway.samples.A.map(function (text) { return { text: text }; })),
    buildNormalized("B", hallway.samples.B.map(function (text) { return { text: text }; }))
  );
  assert.equal(advice.suggestedAmount, null);
  assert.equal(advice.headline, "限期清出楼道，恢复通行");
  assert.match(advice.suggestion, /争议焦点/);
  assert.match(advice.suggestion, /责任与履行/);
  assert.match(advice.suggestion, /分项处理/);
  assert.match(advice.suggestion, /处理结果/);
  assert.doesNotMatch(advice.suggestion, /不提出具体金额|不取双方陈述的平均数/);
  assert.match(advice.suggestion, /被申请人已承认楼道里的东西挡住了通行/);
  assert.doesNotMatch(advice.suggestion, /建议修复金|噪声|楼下住户|楼上住户/);
  assert.equal(hallway.laws.some(function (law) { return /对应关系|对本案/.test(law.citation + law.text); }), false);
});

