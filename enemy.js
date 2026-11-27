// 敵：作る・入れる・動かす・描く（足すものの形）

const MAX_ENEMIES = 6;   // 敵は、同時にこの数まで

// ① 作る：敵を1体作って返す関数（呼ぶたびに、新しい敵が1体できる）
function createEnemy(x, vx) {
  return { x: x, y: floor.y - 32, w: 32, h: 32, vx: vx, alive: true };
}

// ② 入れる：敵をまとめて入れる配列（７-６で入れ直すので let）
let enemies = [];
let spawnTimer = 0;   // 敵を出すタイマー
let nextSpawn = 2;    // 次の敵を出すまでの時間（秒）

// 最初の敵を入れ直す（★ main.js の resetGame から呼ばれる）
function resetEnemies() {
  enemies=[];
  enemies.push(createEnemy(200, 80));
  enemies.push(createEnemy(380, -120));
  enemies.push(createEnemy(540, 60));

  const special = createEnemy(300, 80);   // 作る（ほかの敵と同じ）
  special.type = "faster";                // この敵だけが持つ値を足す
  enemies.push(special);                  // 入れる

  // ★ ここから追加：サイン波で蛇行する敵
  const wavy = createEnemy(450, 40);
  wavy.type = "wavy";
  wavy.baseY = wavy.y; // 基準となるY座標を記録
  wavy.phase = 0;      // 揺れ用のタイマー
  enemies.push(wavy);

  // ★ もう1体追加：途中で一瞬止まってから突進する敵
  const rusher = createEnemy(600, -40);
  rusher.type = "rusher";
  rusher.state = "move"; // "move" -> "pause" -> "dash"
  rusher.timer = 1.2;    // 最初の行動までの秒数
  enemies.push(rusher);

  spawnTimer = 0;
  nextSpawn = 2;
}



// 敵を時間で出す（タイマーの形・くり返す）
function spawnEnemies(dt) {
  spawnTimer = spawnTimer + dt;
  if (spawnTimer >= nextSpawn) {
    if (enemies.length < MAX_ENEMIES) {
      // 左の端か右の端か、くじで決める
      if (Math.random() < 0.5) {
        enemies.push(createEnemy(0, 100));                    // 左の端から、右へ
      } else {
        enemies.push(createEnemy(canvas.width - 32, -100));   // 右の端から、左へ
      }
    }
    spawnTimer = 0;
    nextSpawn = 1 + Math.random() * 2;   // 次は 1〜3 秒のどれか
  }
}

// ③ 動かす：配列の敵を1体ずつ取り出して、同じ処理をする
function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.type === "notice" && Math.abs(player.x - enemy.x) < 150) {
      if (enemy.vx >= 0) {
        enemy.vx = 1000;
      } else {
        enemy.vx = -1000;
      }
    }
    // 蛇行する敵（wavy）：横に進みながら上下に揺れる
    if (enemy.type === "wavy") {
      enemy.phase = (enemy.phase || 0) + dt * 5;
      const baseY = enemy.baseY ?? (floor.y - 32);
      // 床（baseY）より下にめり込まないよう、上側を中心に揺らす
      enemy.y = Math.min(baseY, baseY - Math.abs(Math.sin(enemy.phase)) * 28);
    }

    // 止まってから突進する敵（rusher）
    if (enemy.type === "rusher") {
      enemy.timer = (enemy.timer ?? 1.2) - dt;

      if (!enemy.baseVx) {
        enemy.baseVx = enemy.vx || -120;
      }

      if (enemy.state === "move") {
        enemy.x += enemy.baseVx * dt;
        if (enemy.timer <= 0) {
          enemy.state = "pause";
          enemy.timer = 0.4; // 一瞬止まる（予兆）
        }
      } else if (enemy.state === "pause") {
        // 止まっている間は x を動かさない
        if (enemy.timer <= 0) {
          enemy.state = "dash";
          enemy.timer = 0.45; // 突進する時間
          const dir = player.x < enemy.x ? -1 : 1;
          enemy.dashVx = dir * 360;
        }
      } else if (enemy.state === "dash") {
        enemy.x += enemy.dashVx * dt;
        if (enemy.timer <= 0) {
          enemy.state = "move";
          enemy.timer = 1.2;
          enemy.baseVx = enemy.dashVx > 0 ? 120 : -120;
        }
      }
    } else {
      // wavy や通常の敵は共通の横移動
      enemy.x = enemy.x + enemy.vx * dt;
    }
    // 端を越えたら、位置を戻して、向きを反対に（５-４の跳ね返り）
    if (enemy.x < 0) {
      enemy.x = 0;
      enemy.vx = Math.abs(enemy.vx);
      if (enemy.baseVx) enemy.baseVx = Math.abs(enemy.baseVx);
      if (enemy.dashVx) enemy.dashVx = Math.abs(enemy.dashVx);
    }
    if (enemy.x + enemy.w > canvas.width) {
      enemy.x = canvas.width - enemy.w;
      enemy.vx = -Math.abs(enemy.vx);
      if (enemy.baseVx) enemy.baseVx = -Math.abs(enemy.baseVx);
      if (enemy.dashVx) enemy.dashVx = -Math.abs(enemy.dashVx);
    }
  }
}

// プレイヤーとぶつかったとき：上から落ちてきたときだけ、敵を倒す
function collideWithEnemies(prevBottom) {
  for (const enemy of enemies) {
    if (aabb(player, enemy) && prevBottom <= enemy.y && player.vy > 0) {
      enemy.alive = false;            // 倒した（状態を書き換える）
      player.vy = -JUMP_SPEED / 2;    // 踏んだら、少し跳ねる
      score = score + 1;              // 点数を足す（★ main.js の score を書き換える）
    } else if (aabb(player, enemy) && player.hitTimer <= 0) {
      player.hp = player.hp - 1;      // 横から当たった：HP を減らす（★ player.js の値を書き換える）
      player.hitTimer = HIT_TIME;     // しばらく当たらない
    }
  }
  enemies = enemies.filter((enemy) => enemy.alive);   // 生きている敵だけを残す
}

// ④ 描く：配列の敵を1体ずつ取り出して描く
function drawEnemies() {
  for (const enemy of enemies) {
    if (enemy.type === "notice") {
      ctx.fillStyle = "#ffd166"; // 黄色：近づくと急加速
    } else if (enemy.type === "wavy") {
      ctx.fillStyle = "#66d9ff"; // 水色：ぴょんぴょん揺れる
    } else if (enemy.type === "rusher") {
      ctx.fillStyle = enemy.state === "pause" ? "#ff9f43" : "#c084fc"; // 止まる時は橙、突進系は紫
    } else {
      ctx.fillStyle = "#ff6b6b"; // 赤：通常
    }
    ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
  }
  ctx.fillStyle = "#e8eeff";
  ctx.fillText("敵 = " + enemies.length, 10, 40);
}