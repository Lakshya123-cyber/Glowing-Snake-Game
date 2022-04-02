let dom_replay = document.querySelector("#replay");
let dom_score = document.querySelector("#score");
let dom_canvas = document.createElement("canvas");

document.querySelector("#canvas").appendChild(dom_canvas);

let c = dom_canvas.getContext("2d");

const W = (dom_canvas.width = 400);
const H = (dom_canvas.height = 400);

let snake,
  food,
  currentHue,
  cells = 20,
  cellSize,
  isGameOver = false,
  tails = [],
  score = 00,
  maxScore = window.localStorage.getItem("maxScore") || undefined,
  particles = [],
  splashingParticleCount = 20,
  cellsCount,
  requestID;

let helpers = {
  Vec: class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    add(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    }
    mult(v) {
      if (v instanceof helpers.Vec) {
        this.x *= v.x;
        this.y *= v.y;
        return this;
      } else {
        this.x *= v;
        this.y *= v;
        return this;
      }
    }
  },

  isCollision(v1, v2) {
    return v1.x == v2.x && v1.y == v2.y;
  },

  garbageCollector() {
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].size <= 0) {
        particles.splice(i, 1);
      }
    }
  },

  drawGrid() {
    c.lineWidth = 1.1;
    c.strokeStyle = "#232332";
    c.shadowBlur = 0;

    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;
      c.beginPath();
      c.moveTo(f, 0);
      c.lineTo(f, H);
      c.stroke();
      c.beginPath();
      c.moveTo(0, f);
      c.lineTo(W, f);
      c.stroke();
      c.closePath();
    }
  },

  randHue() {
    return ~~(Math.random() * 360);
  },

  hsl2rgb(hue, saturation, lightness) {
    if (hue == undefined) {
      return [0, 0, 0];
    }

    let chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    let huePrime = hue / 60;
    let secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

    huePrime = ~~huePrime;

    let red;
    let green;
    let blue;

    if (huePrime === 0) {
      red = chroma;
      green = secondComponent;
      blue = 0;
    } else if (huePrime === 1) {
      red = secondComponent;
      green = chroma;
      blue = 0;
    } else if (huePrime === 2) {
      red = 0;
      green = chroma;
      blue = secondComponent;
    } else if (huePrime === 3) {
      red = 0;
      green = secondComponent;
      blue = chroma;
    } else if (huePrime === 4) {
      red = secondComponent;
      green = 0;
      blue = chroma;
    } else if (huePrime === 5) {
      red = chroma;
      green = 0;
      blue = secondComponent;
    }

    let lightnessAdjustment = lightness - chroma / 2;
    red += lightnessAdjustment;
    green += lightnessAdjustment;
    blue += lightnessAdjustment;

    return [
      Math.round(red * 255),
      Math.round(green * 255),
      Math.round(blue * 255),
    ];
  },

  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  },
};

let KEY = {
  ArrowUp: false,
  ArrowRight: false,
  ArrowDown: false,
  ArrowLeft: false,

  resetState() {
    this.ArrowUp = false;
    this.ArrowRight = false;
    this.ArrowDown = false;
    this.ArrowLeft = false;
  },

  listen() {
    addEventListener(
      "keydown",
      (e) => {
        if (e.key === "ArrowUp" && this.ArrowDown) return;
        if (e.key === "ArrowDown" && this.ArrowUp) return;
        if (e.key === "ArrowLeft" && this.ArrowRight) return;
        if (e.key === "ArrowRight" && this.ArrowLeft) return;

        this[e.key] = true;

        Object.keys(this)
          .filter((f) => f !== e.key && f !== "listen" && f !== "resetState")
          .forEach((k) => {
            this[k] = false;
          });
      },
      false
    );
  },
};

class Snake {
  constructor(i, type) {
    this.pos = new helpers.Vec(W / 2, H / 2);
    this.dir = new helpers.Vec(0, 0);
    this.type = type;
    this.index = i;
    this.delay = 5;
    this.size = W / cells;
    this.color = "white";
    this.history = [];
    this.total = 1;
  }

  draw() {
    let { x, y } = this.pos;
    c.fillStyle = this.color;
    c.shadowBlur = 20;
    c.shadowColor = "rgba(255, 255, 255, 0.3)";
    c.fillRect(x, y, this.size, this.size);
    c.shadowBlur = 0;

    if (this.total >= 2) {
      for (let i = 0; i < this.history.length - 1; i++) {
        let { x, y } = this.history[i];
        c.lineWidth = 1;
        c.fillStyle = "rgba(255, 255, 255, 1)";
        c.fillRect(x, y, this.size, this.size);
      }
    }
  }

  walls() {
    let { x, y } = this.pos;

    if (x + cellSize > W) {
      this.pos.x = 0;
    }
    if (y + cellSize > W) {
      this.pos.y = 0;
    }
    if (y < 0) {
      this.pos.y = H - cellSize;
    }
    if (x < 0) {
      this.pos.x = W - cellSize;
    }
  }

  controls() {
    let dir = this.size;

    if (KEY.ArrowUp) {
      this.dir = new helpers.Vec(0, -dir);
    }
    if (KEY.ArrowDown) {
      this.dir = new helpers.Vec(0, dir);
    }
    if (KEY.ArrowLeft) {
      this.dir = new helpers.Vec(-dir, 0);
    }
    if (KEY.ArrowRight) {
      this.dir = new helpers.Vec(dir, 0);
    }
  }

  selfCollision() {
    for (let i = 0; i < this.history.length; i++) {
      let p = this.history[i];

      if (helpers.isCollision(this.pos, p)) {
        isGameOver = true;
      }
    }
  }

  update() {
    this.walls();
    this.draw();
    this.controls();

    if (!this.delay--) {
      if (helpers.isCollision(this.pos, food.pos)) {
        incrementScore();
        particleSplash();
        food.spawn();
        this.total++;
      }
      this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);

      for (let i = 0; i < this.total - 1; i++) {
        this.history[i] = this.history[i + 1];
      }

      this.pos.add(this.dir);
      this.delay = 5;
      this.total > 3 ? this.selfCollision() : null;
    }
  }
}

class Food {
  constructor() {
    this.pos = new helpers.Vec(
      ~~(Math.random() * cells) * cellSize,
      ~~(Math.random() * cells) * cellSize
    );

    this.color = currentHue = `hsl(${~~(Math.random() * 360)}, 100%, 50%)`;
    this.size = cellSize;
  }

  draw() {
    let { x, y } = this.pos;
    c.globalCompositeOperation = "lighter";
    c.shadowBlur = 20;
    c.shadowColor = this.color;
    c.fillStyle = this.color;
    c.fillRect(x, y, this.size, this.size);
    c.globalCompositeOperation = "source-over";
    c.shadowBlur = 0;
  }

  spawn() {
    let randX = ~~(Math.random() * cells) * this.size;
    let randY = ~~(Math.random() * cells) * this.size;

    for (let path of snake.history) {
      if (helpers.isCollision(new helpers.Vec(randX, randY), path)) {
        return this.spawn();
      }
    }
    this.color = currentHue = `hsl(${~~(Math.random() * 360)}, 100%, 50%)`;
    this.pos = new helpers.Vec(randX, randY);
  }
}

class Particle {
  constructor(pos, color, size, vel) {
    this.pos = pos;
    this.color = color;
    this.size = Math.abs(size / 2);
    this.ttl = 0;
    this.gravity = -0.2;
    this.vel = vel;
  }

  draw() {
    let { x, y } = this.pos;
    let hsl = this.color
      .split("")
      .filter((l) => l.match(/[^hsl()$% ]/g))
      .join("")
      .split(",")
      .map((n) => +n);
    let [r, g, b] = helpers.hsl2rgb(hsl[0], hsl[1] / 100, hsl[2] / 100);

    c.shadowColor = `rgb(${r}, ${g}, ${b}, ${1})`;
    c.shadowBlur = 0;
    c.globalCompositeOperation = "lighter";
    c.fillStyle = `rgb(${r}, ${g}, ${b}, ${1})`;
    c.fillRect(x, y, this.size, this.size);
    c.globalCompositeOperation = "source-over";
  }

  update() {
    this.draw();
    this.size -= 0.3;
    this.ttl += 1;
    this.pos.add(this.vel);
    this.vel.y -= this.gravity;
  }
}

function incrementScore() {
  score++;
  dom_score.innerText = score.toString().padStart(2, "0");
}

function particleSplash() {
  for (let i = 0; i < splashingParticleCount; i++) {
    let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
    let position = new helpers.Vec(food.pos.x, food.pos.y);

    particles.push(new Particle(position, currentHue, food.size, vel));
  }
}

function clear() {
  c.clearRect(0, 0, W, H);
}

function initialize() {
  c.imageSmoothingEnabled = false;
  KEY.listen();
  cellsCount = cells * cells;
  cellSize = W / cells;

  snake = new Snake();
  food = new Food();
  dom_replay.addEventListener("click", reset, false);
  loop();
}

function loop() {
  clear();
  if (!isGameOver) {
    requestID = setTimeout(loop, 1000 / 60);
    helpers.drawGrid();
    snake.update();
    food.draw();

    for (let p of particles) {
      p.update();
    }

    helpers.garbageCollector();
  } else {
    clear();
    gameOver();
  }
}

function gameOver() {
  maxScore ? null : (maxScore = score);
  score > maxScore ? (maxScore = score) : null;

  window.localStorage.setItem("maxScore", maxScore);

  c.fillStyle = "#4cffd7";
  c.textAlign = "center";
  c.font = 'bold 30px "Press Start 2P", cursive';
  c.fillText("GAME OVER", W / 2, H / 2);
  c.font = '15px  "Press Start 2P", cursive';
  c.fillText(`SCORE -  ${score}`, W / 2, H / 2 + 60);
  c.fillText(`MAX SCORE - ${maxScore}`, W / 2, H / 2 + 80);
}

function reset() {
  dom_score.innerText = "00";
  score = "00";

  snake = new Snake();

  food.spawn();

  KEY.resetState();

  isGameOver = false;

  clearTimeout(requestID);

  loop();
}

initialize();
