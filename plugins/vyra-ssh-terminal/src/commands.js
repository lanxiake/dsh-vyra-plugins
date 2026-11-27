export const COMMON = [
  ["ls", "\u5217\u76EE\u5F55"],
  ["cd", "\u5207\u6362\u76EE\u5F55"],
  ["cat", "\u67E5\u770B\u6587\u4EF6"],
  ["tail", "\u770B\u6587\u4EF6\u672B\u5C3E\uFF0C\u5E38\u7528 -f \u8DDF\u8E2A\u65E5\u5FD7"],
  ["grep", "\u6309\u5185\u5BB9\u641C\u7D22\u6587\u672C"],
  ["ps", "\u67E5\u770B\u8FDB\u7A0B"],
  ["top", "\u5B9E\u65F6\u8FDB\u7A0B\u4E0E\u8D1F\u8F7D"],
  ["systemctl", "\u7BA1\u7406 systemd \u670D\u52A1"],
  ["journalctl", "\u67E5\u770B systemd \u65E5\u5FD7"],
  ["df", "\u78C1\u76D8\u4F7F\u7528\u7387"],
  ["du", "\u76EE\u5F55\u5360\u7528\u7EDF\u8BA1"],
  ["free", "\u5185\u5B58\u4F7F\u7528"],
  ["tar", "\u6253\u5305\u89E3\u5305"],
  ["curl", "\u53D1 HTTP \u8BF7\u6C42"],
  ["docker", "\u5BB9\u5668\u7BA1\u7406"],
  ["git", "\u7248\u672C\u63A7\u5236"],
  ["vim", "\u7F16\u8F91\u6587\u4EF6"],
  ["less", "\u5206\u9875\u67E5\u770B"],
  ["head", "\u770B\u6587\u4EF6\u5F00\u5934"],
  ["find", "\u6309\u6761\u4EF6\u627E\u6587\u4EF6"],
  ["sed", "\u6D41\u5F0F\u66FF\u6362\u6587\u672C"],
  ["awk", "\u6309\u5217\u5904\u7406\u6587\u672C"],
  ["sort", "\u6392\u5E8F"],
  ["uniq", "\u53BB\u91CD"],
  ["wc", "\u7EDF\u8BA1\u884C\u6570\u5B57\u6570"],
  ["lsblk", "\u5217\u51FA\u5757\u8BBE\u5907"],
  ["lsof", "\u67E5\u770B\u7AEF\u53E3/\u6587\u4EF6\u5360\u7528"],
  ["ss", "\u67E5\u770B\u7F51\u7EDC\u8FDE\u63A5"],
  ["netstat", "\u7F51\u7EDC\u8FDE\u63A5\u4E0E\u7AEF\u53E3"],
  ["ping", "\u6D4B\u8BD5\u8FDE\u901A\u6027"],
  ["nvidia-smi", "\u67E5\u770B GPU \u72B6\u6001"],
  ["iptables", "\u9632\u706B\u5899\u89C4\u5219"],
  ["chmod", "\u6539\u6743\u9650"],
  ["chown", "\u6539\u5C5E\u4E3B"],
  ["cp", "\u590D\u5236"],
  ["mv", "\u79FB\u52A8\u6216\u6539\u540D"],
  ["rm", "\u5220\u9664"],
  ["mkdir", "\u65B0\u5EFA\u76EE\u5F55"],
  ["touch", "\u65B0\u5EFA\u7A7A\u6587\u4EF6/\u66F4\u65B0\u65F6\u95F4"],
  ["ln", "\u5EFA\u94FE\u63A5"],
  ["pwd", "\u5F53\u524D\u8DEF\u5F84"],
  ["echo", "\u8F93\u51FA\u6587\u672C"],
  ["export", "\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF"],
  ["source", "\u5728\u5F53\u524D shell \u6267\u884C\u811A\u672C"],
  ["env", "\u67E5\u770B\u73AF\u5883\u53D8\u91CF"],
  ["which", "\u547D\u4EE4\u7684\u7EDD\u5BF9\u8DEF\u5F84"],
  ["whereis", "\u547D\u4EE4\u76F8\u5173\u7684\u6587\u4EF6"],
  ["man", "\u67E5\u770B\u624B\u518C"],
  ["history", "\u5386\u53F2\u547D\u4EE4"],
  ["crontab", "\u5B9A\u65F6\u4EFB\u52A1"],
  ["date", "\u5F53\u524D\u65F6\u95F4"],
  ["uptime", "\u5F00\u673A\u65F6\u957F\u4E0E\u8D1F\u8F7D"],
  ["who", "\u5F53\u524D\u767B\u5F55\u7528\u6237"],
  ["whoami", "\u5F53\u524D\u7528\u6237\u540D"],
  ["id", "\u7528\u6237\u4E0E\u7EC4\u4FE1\u606F"],
  ["uname", "\u5185\u6838\u4FE1\u606F"],
  ["hostname", "\u4E3B\u673A\u540D"],
  ["kill", "\u6309 PID \u7ED3\u675F\u8FDB\u7A0B"],
  ["pkill", "\u6309\u540D\u5B57\u7ED3\u675F\u8FDB\u7A0B"],
  ["killall", "\u7ED3\u675F\u540C\u540D\u8FDB\u7A0B"],
  ["nohup", "\u540E\u53F0\u5E38\u9A7B\u8FD0\u884C"],
  ["watch", "\u5B9A\u65F6\u91CD\u590D\u6267\u884C"],
  ["screen", "\u4F1A\u8BDD\u4FDD\u6301"],
  ["tmux", "\u7EC8\u7AEF\u590D\u7528"],
  ["crontab -l", "\u5217\u51FA\u5B9A\u65F6\u4EFB\u52A1"],
  ["rsync", "\u589E\u91CF\u540C\u6B65\u6587\u4EF6"],
  ["scp", "\u8FDC\u7A0B\u590D\u5236"],
  ["ssh", "\u767B\u5F55\u53E6\u4E00\u53F0\u673A\u5668"],
  ["ssh-keygen", "\u751F\u6210\u5BC6\u94A5\u5BF9"],
  ["wget", "\u4E0B\u8F7D\u6587\u4EF6"],
  ["unzip", "\u89E3\u538B zip"],
  ["gzip", "\u538B\u7F29/\u89E3\u538B gz"],
  ["zip", "\u6253\u5305 zip"],
  ["uname -a", "\u5B8C\u6574\u7CFB\u7EDF\u4FE1\u606F"],
  ["lscpu", "CPU \u4FE1\u606F"],
  ["lsusb", "USB \u8BBE\u5907"],
  ["lspci", "PCI \u8BBE\u5907"],
  ["dmesg", "\u5185\u6838\u65E5\u5FD7"],
  ["vmstat", "\u7CFB\u7EDF\u6574\u4F53\u72B6\u6001"],
  ["iostat", "\u78C1\u76D8 IO \u7EDF\u8BA1"],
  ["iptables -L", "\u5217\u51FA\u9632\u706B\u5899\u89C4\u5219"],
  ["redis-cli", "\u8FDE\u63A5 Redis"],
  ["mysql", "\u8FDE\u63A5 MySQL"],
  ["nginx", "Nginx \u670D\u52A1"],
  ["make", "\u7F16\u8BD1\u6784\u5EFA"],
  ["gcc", "\u7F16\u8BD1 C"],
  ["python3", "\u8FD0\u884C Python"],
  ["node", "\u8FD0\u884C Node"],
  ["npm", "Node \u5305\u7BA1\u7406"],
  ["pip", "Python \u5305\u7BA1\u7406"],
  ["java", "\u8FD0\u884C Java"],
  ["mvn", "Maven \u6784\u5EFA"],
  ["go", "Go \u5DE5\u5177\u94FE"],
  ["kubectl", "Kubernetes \u96C6\u7FA4"],
  ["pm2", "Node \u8FDB\u7A0B\u7BA1\u7406"],
  ["supervisorctl", "\u7BA1\u7406 supervisord \u8FDB\u7A0B"],
  ["service", "\u670D\u52A1\u7BA1\u7406\uFF08\u65E7\u7248\uFF09"],
  ["apt", "Debian \u7CFB\u5305\u7BA1\u7406"],
  ["yum", "RedHat \u7CFB\u5305\u7BA1\u7406"],
  ["dnf", "Fedora \u7CFB\u5305\u7BA1\u7406"],
  ["firewall-cmd", "firewalld \u89C4\u5219"],
  ["sysctl", "\u5185\u6838\u53C2\u6570"],
  ["mount", "\u6302\u8F7D"],
  ["umount", "\u5378\u8F7D"],
  ["blkid", "\u5757\u8BBE\u5907 UUID"],
  ["fdisk", "\u78C1\u76D8\u5206\u533A"],
  ["reboot", "\u91CD\u542F\u673A\u5668"],
  ["shutdown", "\u5173\u673A"],
  ["sudo", "\u4EE5 root \u6267\u884C"],
  ["su", "\u5207\u6362\u7528\u6237"],
  ["passwd", "\u6539\u5BC6\u7801"],
  ["useradd", "\u65B0\u5EFA\u7528\u6237"],
  ["diff", "\u6BD4\u8F83\u4E24\u4E2A\u6587\u4EF6"],
  ["md5sum", "\u7B97 MD5"],
  ["sha256sum", "\u7B97 SHA256"],
  ["base64", "base64 \u7F16\u89E3\u7801"],
  ["tree", "\u6811\u72B6\u5217\u76EE\u5F55"],
  ["stat", "\u6587\u4EF6\u5143\u4FE1\u606F"],
  ["file", "\u8BC6\u522B\u6587\u4EF6\u7C7B\u578B"],
  ["type", "\u547D\u4EE4\u662F\u5185\u5EFA\u8FD8\u662F\u5916\u90E8"],
  ["alias", "\u67E5\u770B\u6216\u5B9A\u4E49\u522B\u540D"],
  ["history -c", "\u6E05\u7A7A\u5386\u53F2"]
];
export const SUBCOMMANDS = {
  systemctl: [
    ["status ", "\u770B\u670D\u52A1\u72B6\u6001\uFF0C\u670D\u52A1\u540D\u8DDF\u5728\u540E\u9762"],
    ["restart ", "\u91CD\u542F\u670D\u52A1"],
    ["reload ", "\u53EA\u91CD\u8BFB\u914D\u7F6E\uFF0C\u4E0D\u65AD\u5F00\u8FDE\u63A5"],
    ["start ", "\u542F\u52A8"],
    ["stop ", "\u505C\u6B62"],
    ["enable --now ", "\u8BBE\u4E3A\u5F00\u673A\u81EA\u542F\u5E76\u7ACB\u523B\u542F\u52A8"],
    ["list-units --failed", "\u54EA\u4E9B\u670D\u52A1\u8D77\u6302\u4E86"],
    ["status -l --no-pager ", "\u957F\u8F93\u51FA\u4E0D\u5206\u9875"],
    ["daemon-reload", "\u6539\u5B8C unit \u6587\u4EF6\u540E\u91CD\u8F7D"]
  ],
  journalctl: [
    ["-u nginx -f", "\u8DDF\u8E2A\u67D0\u4E2A\u670D\u52A1\u7684\u65E5\u5FD7"],
    ["-u nginx -n 200 --no-pager", "\u6700\u8FD1 200 \u884C"],
    ["-xe --no-pager", "\u6700\u8FD1\u7684\u9519\u8BEF\u53CA\u89E3\u91CA"],
    ["--since '1 hour ago'", "\u6309\u65F6\u95F4\u8303\u56F4\u770B"],
    ["-b -p err", "\u672C\u6B21\u542F\u52A8\u4EE5\u6765\u7684\u9519\u8BEF"],
    ["--disk-usage", "journal \u5360\u4E86\u591A\u5C11\u78C1\u76D8"],
    ["--vacuum-time=7d", "\u53EA\u4FDD\u7559 7 \u5929"]
  ],
  docker: [
    ["ps -a", "\u6240\u6709\u5BB9\u5668"],
    ["logs -f --tail 200 ", "\u8DDF\u8E2A\u5BB9\u5668\u65E5\u5FD7\uFF08\u8DDF\u5BB9\u5668\u540D\uFF09"],
    ["exec -it ", "\u8FDB\u5BB9\u5668\uFF08\u8DDF\u5BB9\u5668\u540D sh\uFF09"],
    ["images", "\u672C\u5730\u955C\u50CF"],
    ["stats --no-stream", "\u4E00\u6B21\u8D44\u6E90\u5360\u7528\u5FEB\u7167"],
    ["inspect ", "\u5BB9\u5668\u8BE6\u60C5 JSON"],
    ["system df", "\u955C\u50CF\u4E0E\u5377\u5404\u5360\u591A\u5C11"],
    ["compose ps", "compose \u670D\u52A1\u72B6\u6001"],
    ["compose logs -f --tail 100", "\u8DDF\u8E2A compose \u5168\u90E8\u65E5\u5FD7"],
    ["compose up -d", "\u540E\u53F0\u62C9\u8D77 compose"],
    ["compose restart ", "\u91CD\u542F\u67D0\u4E2A\u670D\u52A1"]
  ],
  kubectl: [
    ["get pods -A -o wide", "\u6240\u6709 Pod \u53CA\u6240\u5728\u8282\u70B9"],
    ["get pods -A --field-selector=status.phase!=Running", "\u4E0D\u6B63\u5E38\u7684 Pod"],
    ["get nodes -o wide", "\u8282\u70B9\u72B6\u6001\u4E0E\u7248\u672C"],
    ["get events -A --sort-by=.lastTimestamp | tail -30", "\u6700\u8FD1\u7684\u96C6\u7FA4\u4E8B\u4EF6"],
    ["top pods -A", "Pod \u8D44\u6E90\u5360\u7528"],
    ["logs -f deploy/app --tail=200", "\u8DDF\u5E94\u7528\u65E5\u5FD7\uFF08\u6539 deploy/app\uFF09"],
    ["exec -it deploy/app -- sh", "\u8FDB\u5BB9\u5668"],
    ["describe pod app-0", "Pod \u8BE6\u60C5\uFF0C\u5148\u770B Events"],
    ["rollout restart deploy/app", "\u6EDA\u52A8\u91CD\u542F"],
    ["rollout status deploy/app", "\u6EDA\u52A8\u66F4\u65B0\u8FDB\u5EA6"],
    ["apply -f deploy.yaml", "\u5E94\u7528\u6E05\u5355"],
    ["delete pod app-0", "\u5220 Pod \u89E6\u53D1\u91CD\u5EFA"]
  ],
  git: [
    ["status", "\u5DE5\u4F5C\u533A\u72B6\u6001"],
    ["diff", "\u672A\u6682\u5B58\u7684\u6539\u52A8"],
    ["diff --staged", "\u5DF2\u6682\u5B58\u7684\u6539\u52A8"],
    ["log --oneline --graph -20", "\u7D27\u51D1\u7684\u5386\u53F2\u56FE"],
    ["add -A", "\u6682\u5B58\u5168\u90E8\u6539\u52A8"],
    ["commit -m ''", "\u63D0\u4EA4\uFF0C\u5F15\u53F7\u91CC\u5199\u8BF4\u660E"],
    ["push", "\u63A8\u5230\u8FDC\u7AEF"],
    ["pull --rebase", "\u62C9\u53D6\u5E76\u53D8\u57FA\uFF0C\u5386\u53F2\u66F4\u5E72\u51C0"],
    ["stash", "\u6682\u5B58\u5F53\u524D\u6539\u52A8"],
    ["stash pop", "\u628A\u6682\u5B58\u7684\u6539\u56DE\u6765"],
    ["switch -c feature/x", "\u65B0\u5EFA\u5E76\u5207\u5230\u5206\u652F"],
    ["branch -a", "\u672C\u5730\u4E0E\u8FDC\u7AEF\u5206\u652F"],
    ["remote -v", "\u8FDC\u7AEF\u5730\u5740"],
    ["restore .", "\u4E22\u5F03\u5DE5\u4F5C\u533A\u6539\u52A8"],
    ["reset --hard HEAD", "\u4E22\u5F03\u5168\u90E8\u672A\u63D0\u4EA4\u6539\u52A8"]
  ],
  apt: [
    ["update", "\u5237\u65B0\u5305\u7D22\u5F15"],
    ["upgrade", "\u5347\u7EA7\u5DF2\u5B89\u88C5\u7684\u5305"],
    ["install ", "\u5B89\u88C5\uFF0C\u8DDF\u5305\u540D"],
    ["remove --purge ", "\u5378\u8F7D\u5E76\u6E05\u6389\u914D\u7F6E"],
    ["list --upgradable", "\u53EF\u5347\u7EA7\u7684\u5305"],
    ["autoremove", "\u6E05\u7406\u4E0D\u518D\u9700\u8981\u7684\u4F9D\u8D56"],
    ["search ", "\u641C\u7D22\u5305"],
    ["show ", "\u5305\u7684\u8BE6\u60C5\u4E0E\u4F9D\u8D56"]
  ],
  yum: [
    ["check-update", "\u53EF\u5347\u7EA7\u7684\u5305"],
    ["update", "\u5347\u7EA7"],
    ["install ", "\u5B89\u88C5\uFF0C\u8DDF\u5305\u540D"],
    ["remove ", "\u5378\u8F7D"],
    ["search ", "\u641C\u7D22\u5305"],
    ["info ", "\u5305\u7684\u8BE6\u60C5"],
    ["clean all", "\u6E05\u7A7A\u7F13\u5B58"]
  ],
  tar: [
    ["-czf backup.tar.gz ", "\u6253\u5305\u538B\u7F29\uFF0C\u8DDF\u8981\u6253\u5305\u7684\u76EE\u5F55"],
    ["-xzf ", "\u89E3\u538B .tar.gz"],
    ["-tzf ", "\u53EA\u770B\u538B\u7F29\u5305\u91CC\u6709\u5565\uFF0C\u4E0D\u89E3\u5F00"],
    ["-czf backup.tar.gz --exclude=.git .", "\u6392\u9664 .git \u6253\u5305"],
    ["-xzf x.tar.gz -C /tmp", "\u89E3\u5230\u6307\u5B9A\u76EE\u5F55"],
    ["-cJf backup.tar.xz ", "\u7528 xz \u538B\uFF0C\u4F53\u79EF\u6700\u5C0F"],
    ["-cjf backup.tar.bz2 ", "\u7528 bzip2 \u538B"]
  ],
  find: [
    ['. -type f -name "*.log"', "\u6309\u540D\u5B57\u627E\u6587\u4EF6"],
    [". -type d -name node_modules", "\u6309\u540D\u5B57\u627E\u76EE\u5F55"],
    [". -type f -mtime -1", "\u4E00\u5929\u5185\u6539\u52A8\u8FC7\u7684"],
    [". -type f -size +100M", "\u5927\u4E8E 100MB \u7684\u6587\u4EF6"],
    ["/var -type f -mtime +30 -delete", "\u6E05\u7406 30 \u5929\u524D\u7684\u6587\u4EF6"],
    [". -perm -4000 -type f", "SUID \u7A0B\u5E8F"],
    ['. -type f -exec grep -l "keyword" {} +', "\u5728\u627E\u5230\u7684\u6587\u4EF6\u91CC\u641C\u5185\u5BB9"]
  ],
  grep: [
    ["-rn 'keyword' .", "\u9012\u5F52\u641C\u7D22\u5E76\u663E\u793A\u884C\u53F7"],
    ["-i -n 'error' app.log", "\u5FFD\u7565\u5927\u5C0F\u5199"],
    ["-v '^#' nginx.conf", "\u53CD\u5411\u5339\u914D\uFF0C\u53BB\u6389\u6CE8\u91CA\u884C"],
    ["-A 3 -B 3 'error' app.log", "\u5E26\u524D\u540E\u4E09\u884C\u4E0A\u4E0B\u6587"],
    ["-c 'error' app.log", "\u53EA\u6570\u5339\u914D\u884C\u6570"],
    ['-E "a|b" file', "\u6269\u5C55\u6B63\u5219\uFF0C\u7528 | \u5E76\u5217"],
    ["-l 'keyword' *.log", "\u53EA\u5217\u6587\u4EF6\u540D"]
  ],
  sed: [
    ["-n '100,200p' app.log", "\u6253\u5370\u6307\u5B9A\u884C\u533A\u95F4"],
    ["-i.bak 's/old/new/g' file", "\u5C31\u5730\u66FF\u6362\u5E76\u7559\u4E00\u4EFD\u5907\u4EFD"],
    ["'/^$/d' file", "\u5220\u6389\u7A7A\u884C"],
    ["'/^#/d' file", "\u5220\u6389\u6CE8\u91CA\u884C"],
    ["'s/\\t/ /g' file", "\u628A\u5236\u8868\u7B26\u6362\u6210\u7A7A\u683C"]
  ],
  awk: [
    ["'{print $1}' file", "\u6253\u5370\u7B2C\u4E00\u5217"],
    ["-F: '{print $1}' /etc/passwd", "\u6307\u5B9A\u5206\u9694\u7B26"],
    ["'{print $NF}' file", "\u6253\u5370\u6700\u540E\u4E00\u5217"],
    ["'$3 > 100 {print $0}' file", "\u6309\u6761\u4EF6\u8FC7\u6EE4"],
    ["'{sum+=$5} END {print sum}' file", "\u628A\u7B2C\u4E94\u5217\u6C42\u548C"],
    ["'NR==10' file", "\u53EA\u770B\u7B2C 10 \u884C"]
  ],
  ps: [
    ["aux", "BSD \u98CE\u683C\u7684\u5168\u91CF\u8FDB\u7A0B"],
    ["-ef", "System V \u98CE\u683C\u7684\u5168\u91CF\u8FDB\u7A0B"],
    ["aux --sort=-%mem | head", "\u6309\u5185\u5B58\u6392\u5E8F"],
    ["-eo pid,ppid,etime,cmd", "\u53EA\u6311\u5173\u5FC3\u7684\u5217"],
    ["-ef | grep java", "\u6309\u5173\u952E\u5B57\u627E\u8FDB\u7A0B"]
  ],
  ls: [
    ["-alh", "\u957F\u5217\u8868\uFF0C\u5927\u5C0F\u597D\u8BFB"],
    ["-alh --time-style=long-iso", "\u65F6\u95F4\u683C\u5F0F\u89C4\u6574\u7684\u957F\u5217\u8868"],
    ["-lt", "\u6309\u4FEE\u6539\u65F6\u95F4\u6392\u5E8F"],
    ["-lhS", "\u6309\u5927\u5C0F\u6392\u5E8F"],
    ["-alh /var/log", "\u770B\u6307\u5B9A\u76EE\u5F55"]
  ],
  df: [
    ["-h", "\u4EBA\u7C7B\u53EF\u8BFB\u7684\u7528\u91CF"],
    ["-hT", "\u5E26\u6587\u4EF6\u7CFB\u7EDF\u7C7B\u578B"],
    ["-i", "inode \u7528\u91CF\uFF0C\u78C1\u76D8\u6CA1\u6EE1\u5374\u5199\u4E0D\u8FDB\u53BB\u65F6\u770B\u5B83"],
    ["-h /var", "\u53EA\u770B\u67D0\u4E2A\u76EE\u5F55\u6240\u5728\u7684\u5206\u533A"],
    ["--total", "\u672B\u5C3E\u7ED9\u4E00\u884C\u603B\u8BA1"]
  ],
  du: [
    ["-sh *", "\u5F53\u524D\u76EE\u5F55\u4E0B\u6BCF\u9879\u7684\u603B\u5360\u7528"],
    ["-sh .", "\u5F53\u524D\u76EE\u5F55\u603B\u5360\u7528"],
    ["-h --max-depth=1", "\u53EA\u770B\u4E00\u5C42"],
    ["-sh * | sort -rh | head", "\u5360\u7528\u6392\u884C\u524D\u51E0"]
  ],
  ss: [
    ["-tunlp", "\u76D1\u542C\u7684\u7AEF\u53E3\u4E0E\u5BF9\u5E94\u8FDB\u7A0B"],
    ["-s", "\u8FDE\u63A5\u6570\u603B\u89C8"],
    ["-tnp", "\u5DF2\u5EFA\u7ACB\u7684\u8FDE\u63A5\u4E0E\u8FDB\u7A0B"],
    ["-tan state established | wc -l", "\u7EDF\u8BA1\u5E76\u53D1\u8FDE\u63A5\u6570"],
    ["-tunlp | grep :80", "\u8C01\u5360\u4E86 80 \u7AEF\u53E3"]
  ],
  ip: [
    ["-br a", "\u6240\u6709\u7F51\u5361\u4E0E\u5730\u5740\uFF0C\u7B80\u6D01"],
    ["-s link", "\u7F51\u5361\u6536\u53D1\u4E0E\u9519\u8BEF\u7EDF\u8BA1"],
    ["route", "\u8DEF\u7531\u8868"],
    ["link", "\u94FE\u8DEF\u5C42\u72B6\u6001"],
    ["neigh", "ARP \u90BB\u5C45\u8868"]
  ],
  curl: [
    ["-I ", "\u53EA\u770B\u54CD\u5E94\u5934"],
    ['-L -s -o /dev/null -w "%{http_code} %{time_total}s\\n" ', "\u6D4B\u54CD\u5E94\u7801\u4E0E\u603B\u8017\u65F6"],
    ["-X POST -H 'Content-Type: application/json' -d '{}' ", "\u53D1\u4E00\u4E2A JSON POST"],
    ["-k ", "\u8DF3\u8FC7\u8BC1\u4E66\u6821\u9A8C\uFF0C\u81EA\u7B7E\u8BC1\u4E66\u8C03\u8BD5\u7528"],
    ["-O ", "\u4E0B\u8F7D\u5230\u5F53\u524D\u76EE\u5F55"],
    ["--resolve example.com:443:10.0.0.1 ", "\u4E0D\u6539 DNS\uFF0C\u76F4\u63A5\u6307\u5B9A\u89E3\u6790\u7ED3\u679C"]
  ],
  ssh: [
    ["-i ~/.ssh/id_rsa ", "\u6307\u5B9A\u79C1\u94A5"],
    ["-p 2222 ", "\u6307\u5B9A\u7AEF\u53E3"],
    ["-L 8080:127.0.0.1:80 ", "\u672C\u5730\u7AEF\u53E3\u8F6C\u53D1"],
    ["-N -f -L 3306:127.0.0.1:3306 ", "\u540E\u53F0\u5E38\u9A7B\u8F6C\u53D1"],
    ["-v ", "\u8C03\u8BD5\u65E5\u5FD7\uFF0C\u8FDE\u4E0D\u4E0A\u65F6\u770B\u5B83"],
    ["-o ConnectTimeout=5 -o BatchMode=yes ", "\u975E\u4EA4\u4E92\u63A2\u6D4B\u80FD\u4E0D\u80FD\u8FDE\u4E0A"]
  ],
  scp: [
    ["-r ./dir user@host:/data/", "\u9012\u5F52\u4E0A\u4F20\u76EE\u5F55"],
    ["user@host:/data/file ./", "\u4E0B\u8F7D\u5230\u5F53\u524D\u76EE\u5F55"],
    ["-P 2222 ", "\u6307\u5B9A\u7AEF\u53E3\uFF0C\u6CE8\u610F\u662F\u5927\u5199 P"],
    ["-C user@host:/big.tar.gz .", "\u4F20\u8F93\u65F6\u987A\u4FBF\u538B\u7F29"]
  ],
  rsync: [
    ["-avz --progress ./ user@host:/data/", "\u589E\u91CF\u540C\u6B65\u5E76\u663E\u793A\u8FDB\u5EA6"],
    ["-avz --delete ./ user@host:/data/", "\u955C\u50CF\u540C\u6B65\uFF0C\u5BF9\u7AEF\u591A\u4F59\u6587\u4EF6\u4F1A\u5220\u6389"],
    ["-avz --exclude=.git --exclude=node_modules ./ user@host:/data/", "\u6392\u9664\u76EE\u5F55\u540C\u6B65"],
    ["-avz --dry-run ./ user@host:/data/", "\u5148\u7A7A\u8DD1\u4E00\u904D\u770B\u4F1A\u52A8\u54EA\u4E9B\u6587\u4EF6"],
    ["-avz --bwlimit=2m ./ user@host:/data/", "\u9650\u901F 2MB/s"]
  ],
  dig: [
    ["+short example.com", "\u53EA\u8981\u89E3\u6790\u7ED3\u679C"],
    ["@8.8.8.8 example.com", "\u6307\u5B9A DNS \u670D\u52A1\u5668"],
    ["+trace example.com", "\u8DDF\u7740\u9012\u5F52\u770B\u6BCF\u4E00\u8DF3"],
    ["-x 8.8.8.8", "\u53CD\u67E5 PTR"],
    ["ANY example.com", "\u8981\u6240\u6709\u8BB0\u5F55\u7C7B\u578B"]
  ],
  lsof: [
    ["-i:80", "\u8C01\u5360\u7740 80 \u7AEF\u53E3"],
    ["-i -P -n", "\u6240\u6709\u7F51\u7EDC\u6587\u4EF6\u4E0E\u8FDB\u7A0B"],
    ["-p $(pgrep -f java | head -1)", "\u67D0\u4E2A\u8FDB\u7A0B\u6253\u5F00\u4E86\u54EA\u4E9B\u6587\u4EF6"],
    ["+L1", "\u5DF2\u5220\u9664\u4F46\u4ECD\u88AB\u5360\u7528\u7684\u6587\u4EF6"],
    ["-u root", "\u67D0\u4E2A\u7528\u6237\u6253\u5F00\u7684\u6587\u4EF6"],
    ["-c nginx", "\u67D0\u4E2A\u8FDB\u7A0B\u540D\u6253\u5F00\u7684\u6587\u4EF6"]
  ],
  tcpdump: [
    ["-i any -nn port 80 -c 20", "\u6293 20 \u4E2A\u5305"],
    ["-i eth0 -w cap.pcap", "\u5B58\u5230\u6587\u4EF6\u91CC\u6162\u6162\u770B"],
    ["-nn host 10.0.0.1", "\u53EA\u770B\u67D0\u53F0\u4E3B\u673A"],
    ["-nn -A port 80", "\u6309 ASCII \u663E\u793A\u5185\u5BB9"],
    ["-i any -nn icmp", "\u53EA\u770B ICMP"]
  ],
  nginx: [
    ["-t", "\u68C0\u67E5\u914D\u7F6E\u8BED\u6CD5"],
    ["-T", "\u6253\u5370\u751F\u6548\u7684\u5B8C\u6574\u914D\u7F6E"],
    ["-s reload", "\u5E73\u6ED1\u91CD\u8F7D"],
    ["-s stop", "\u505C\u6B62"],
    ["-V", "\u7F16\u8BD1\u53C2\u6570\uFF0C\u770B\u88C5\u4E86\u54EA\u4E9B\u6A21\u5757"]
  ],
  mysql: [
    ["-uroot -p", "\u7528 root \u8FDE\u63A5\uFF0C\u4F1A\u63D0\u793A\u8F93\u5BC6\u7801"],
    ["-uroot -p -e ", "\u76F4\u63A5\u6267\u884C\u4E00\u6761\u8BED\u53E5"],
    ["-h 10.0.0.1 -uroot -p", "\u8FDE\u8FDC\u7A0B\u5B9E\u4F8B"],
    ["-uroot -p db < backup.sql", "\u628A\u5907\u4EFD\u5BFC\u56DE\u5E93\u91CC\uFF0C\u5148\u5EFA\u597D\u5E93"],
    ['-uroot -p -e "show processlist"', "\u5F53\u524D\u8FDE\u63A5\u4E0E\u6B63\u5728\u6267\u884C\u7684\u8BED\u53E5"],
    ["-uroot -p --default-character-set=utf8mb4", "\u6307\u5B9A\u5B57\u7B26\u96C6\uFF0C\u907F\u514D\u4E2D\u6587\u4E71\u7801"]
  ],
  "redis-cli": [
    ["ping", "\u770B\u8FD8\u6D3B\u7740\u6CA1"],
    ["info", "\u5168\u90E8\u8FD0\u884C\u4FE1\u606F"],
    ["info memory", "\u5185\u5B58\u5360\u7528\u4E0E\u788E\u7247\u7387"],
    ["--bigkeys", "\u626B\u51FA\u5927 key\uFF0C\u522B\u5728\u9AD8\u5CF0\u671F\u8DD1"],
    ["dbsize", "\u5F53\u524D\u5E93\u6709\u591A\u5C11 key"],
    ["-h 10.0.0.1 -p 6379", "\u8FDE\u8FDC\u7A0B\u5B9E\u4F8B"],
    ["slowlog get 10", "\u6700\u8FD1 10 \u6761\u6162\u67E5\u8BE2"]
  ],
  npm: [
    ["run build", "\u8DD1\u6784\u5EFA\u811A\u672C"],
    ["run dev", "\u8D77\u5F00\u53D1\u670D\u52A1"],
    ["install", "\u6309 package.json \u88C5\u4F9D\u8D56"],
    ["ci", "\u4E25\u683C\u6309 lock \u6587\u4EF6\u5E72\u51C0\u5B89\u88C5"],
    ["ls -g --depth=0", "\u5168\u5C40\u88C5\u4E86\u4EC0\u4E48"],
    ["view react version", "\u67E5\u8FDC\u7AEF\u7684\u5305\u7248\u672C"]
  ],
  pm2: [
    ["list", "\u8FDB\u7A0B\u6E05\u5355\u4E0E\u91CD\u542F\u6B21\u6570"],
    ["logs --lines 200 ", "\u770B\u67D0\u4E2A\u5E94\u7528\u7684\u65E5\u5FD7"],
    ["restart all", "\u5168\u91CF\u91CD\u542F"],
    ["reload all", "\u96F6\u505C\u673A\u91CD\u8F7D"],
    ["monit", "\u5B9E\u65F6\u9762\u677F"],
    ["save", "\u5B58\u4E0B\u8FDB\u7A0B\u5217\u8868\uFF0C\u5F00\u673A\u81EA\u542F\u9760\u5B83"]
  ],
  supervisorctl: [
    ["status", "\u6240\u6709\u8FDB\u7A0B\u7684\u72B6\u6001"],
    ["restart all", "\u5168\u91CF\u91CD\u542F"],
    ["tail -f ", "\u8DDF\u8E2A\u67D0\u4E2A\u8FDB\u7A0B\u7684\u65E5\u5FD7"],
    ["update", "\u91CD\u8BFB\u914D\u7F6E\u5E76\u70ED\u52A0\u8F7D"],
    ["reread", "\u53EA\u91CD\u8BFB\u914D\u7F6E\uFF0C\u4E0D\u91CD\u542F"]
  ],
  "firewall-cmd": [
    ["--list-all", "\u5F53\u524D\u751F\u6548\u7684\u89C4\u5219"],
    ["--reload", "\u91CD\u8F7D\u914D\u7F6E"],
    ["--add-port=8080/tcp --permanent", "\u6C38\u4E45\u653E\u884C\u7AEF\u53E3\uFF0C\u8BB0\u5F97 reload"],
    ["--remove-port=8080/tcp --permanent", "\u64A4\u6389\u653E\u884C"],
    ["--add-service=https --permanent", "\u653E\u884C\u9884\u5B9A\u4E49\u670D\u52A1"]
  ]
};
export function suggest(line, history, limit) {
  const prefix = line.trimStart();
  if (!prefix || limit <= 0) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set([prefix]);
  for (const cmd of [...history].reverse()) {
    if (out.length >= limit) break;
    if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
    seen.add(cmd);
    out.push({ cmd });
  }
  const space = prefix.indexOf(" ");
  if (space > 0) {
    const head = prefix.slice(0, space);
    for (const [sub, hint] of SUBCOMMANDS[head] ?? []) {
      if (out.length >= limit) break;
      const cmd = `${head} ${sub}`;
      if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
      seen.add(cmd);
      out.push({ cmd, hint });
    }
    return out;
  }
  for (const [cmd, hint] of COMMON) {
    if (out.length >= limit) break;
    if (seen.has(cmd) || !cmd.startsWith(prefix)) continue;
    seen.add(cmd);
    out.push({ cmd, hint });
  }
  return out;
}
