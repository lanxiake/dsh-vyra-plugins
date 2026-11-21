#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# StudyMate · lab 断言（示例）——只回事实：不印判决词，不立第二套码表
#
# **出题角色填的就是这一个文件**（连同任务、作答格与探针）：把下面三段换成这一课真正的断言。
# 参数由 `check.sh` 原样递过来：$1 任务目录、$2 作答目录、$3 探针目录。
#
# 每一段只印两种事实：
#   · **此刻实测**到什么——判据现场算（读文件、跑命令、列目录），**别写死数字与日期**；
#   · **作答里读到**什么——哪一格空着就直说空着，别替它猜。
# 读不到、对不上，就让本脚本的退出码非零：那只说明「这一格此刻立不住」，是不是判学生没过，
# 由跑手记下的事实与总控按 `layered-practice` 第五节的三档看，这里不表态。
#
# 断言写成 POSIX sh（入口用 `sh` 跑它，跟 `sh check.sh` 同一个解释器）；要别的语言就在
# 这一段里 `exec` 它——「证据」里那条命令仍只是 `sh check.sh`（约定见 `README.md` 第二节）。
# 变量名一律 ASCII：`sh` 认不得中文变量名。
# ─────────────────────────────────────────────────────────────────────────
set -u

TASK=$1
ANSWERS=$2
PROBES=$3
CODE=0
MEASURED=

# ── 第 1 格：探针此刻实测是什么（现场算，不写死）────────────────────────
SAMPLE=$PROBES/样本.txt
if [ -f "$SAMPLE" ]; then
  MEASURED=$(wc -l < "$SAMPLE" | tr -d '[:space:]')
  printf '探针 %s：此刻实测 %s 行\n' "$SAMPLE" "$MEASURED"
else
  printf '探针不在：%s\n' "$SAMPLE"
  CODE=1
fi

# ── 第 2 格：作答里写下的那一格（空着就直说空着）────────────────────────
SHEET=$ANSWERS/任务1.txt
WROTE=
if [ -f "$SHEET" ]; then
  WROTE=$(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "$SHEET" | head -1 | tr -d '[:space:]')
  printf '作答 %s：%s\n' "$SHEET" "${WROTE:-这一格还空着}"
  [ -n "$WROTE" ] || CODE=1
else
  printf '作答文件不在：%s\n' "$SHEET"
  CODE=1
fi

# ── 第 3 格：两边差在哪（两边都读到时才比）──────────────────────────────
if [ -n "$MEASURED" ] && [ -n "$WROTE" ] && [ "$WROTE" != "$MEASURED" ]; then
  printf '差：探针实测 %s，作答写下的是 %s\n' "$MEASURED" "$WROTE"
  CODE=1
fi

exit "$CODE"
