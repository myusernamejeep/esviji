/***************************************************************************************
 * esviji
 ***************************************************************************************/

var ESVIJI = {};

ESVIJI.settings = {
  'board': {
    'width': 320,
    'height': 460
  },
  'pieces': ['piece1', 'piece2', 'piece3', 'piece4', 'piece5', 'piece6'],
  'rocks': ['rock'],
  'emptyId': 0,
  'rockId': -1,
  'launch': {
    'lives': 9,
    'score': 0,
    'level': 1
  },
  'turn': {
    'posX': 10,
    'dirX': -1,
    'posY': 8,
    'dirY': 0
  },
  'durationMove': 0.2,
  'durationMorph': 0.8
};

ESVIJI.game = (function () {
  var
    drawnCurrentPieces = [],
    validPieces = [],
    drawnCurrentPiece = null,
    stackedAnimationToStart = 1,
    lastStackedAnimation = 0,
    currentPosX = 0,
    currentPosY = 0,
    currentDirX = -1,
    currentDirY = 0,
    dragged = false,
    moveCount = 0,
    cursorY = 0,
    cursorMinY = 0,
    cursorMaxY = 0,
    maxAvailablePieces = 0,
    nbPieces = 0,
    scoreThisTurn = 0,
    storageScores = store.get('scores') || [ ],
    gameStatus = store.get('gameStatus') || {
      'currentPieces': [],
      'currentPiece': 0,
      'level': 0,
      'score': 0,
      'lives': 0,
      'playing': false
    },
    useStored = false;

  function init() {
    cursorMinY = yToSvg(1);
    cursorMaxY = yToSvg(13);
    maxAvailablePieces = ESVIJI.settings.pieces.length;

    if (typeof gameStatus.playing === 'undefined' || gameStatus.playing === false) {
      _gaq.push(['_trackEvent', 'Init', 'Init']);
      $('#main .start').on('click', startPlaying);
      $('#main .tutorial').on('click', startTutorial);
      $('#main .about').on('click', function() {
        window.location.href="https://github.com/nhoizey/esviji/blob/master/README.md";
      });
    } else {
      _gaq.push(['_trackEvent', 'Init', 'Restore']);
      useStored = true;
      startPlaying();
    }
  }

  function startPlaying() {
    if (!useStored) {
      _gaq.push(['_trackEvent', 'Play', 'Start']);
      gameStatus.level = ESVIJI.settings.launch.level;
      gameStatus.score = ESVIJI.settings.launch.score;
      gameStatus.lives = ESVIJI.settings.launch.lives;
      $('#play').remove();
      if (drawnCurrentPiece !== null) {
        drawnCurrentPiece.remove();
        drawnCurrentPiece = null;
      }
    }
    $('#playPanel').clone().attr('id', 'play').appendTo('#board');
    $('.pauseButton').on('click', pause);
    //  $("#fullscreen").on("click", function() {
    //    fs = new Fullscreen($("#board"));
    //    fs.request();
    //  });
    nextLevel();
  }

  function startTutorial() {
    _gaq.push(['_trackEvent', 'Tutorial', 'Start']);
    tuto = $('#tutorialPanel').clone().attr('id', 'tutorial');
    $('#tutorialPanel').remove();
    tuto.appendTo('#board');
    $('#tutoAnimEnd')[0].addEventListener("endEvent", endTutorial, false);
    $('#tutoAnimStart')[0].beginElement();
  }

  function endTutorial() {
    _gaq.push(['_trackEvent', 'Tutorial', 'End']);
    tuto = $('#tutorial').clone().attr('id', 'tutorialPanel');
    $('#tutorial').remove();
    tuto.appendTo('#board defs');
  }

  function nextLevel() {
    gameStatus.playing = true;
    drawScore();
    drawLevel();
    drawLives();
    if (!useStored) {
      erasePieces();
      initPieces();
      drawPieces();
      getValidPieces();
      gameStatus.currentPiece = validPieces[Math.floor(Math.random() * validPieces.length)];
    } else {
      drawPieces();
    }
    stackedAnimationToStart = 1;
    lastStackedAnimation = 0;
    startNewTurn();
  }

  function startNewTurn() {
    currentPosX = ESVIJI.settings.turn.posX;
    currentDirX = ESVIJI.settings.turn.dirX;
    currentPosY = ESVIJI.settings.turn.posY;
    currentDirY = ESVIJI.settings.turn.dirY;
    scoreThisTurn = 0;
    getValidPieces();

    if (validPieces.length === 0) {
      // no more valid piece, end of the turn
      drawnCurrentPiece.remove(); // TODO: animate
      drawnCurrentPiece = null;
      gameStatus.level++;
      gameStatus.lives++;
      nextLevel();
    } else {
      if (validPieces.indexOf(gameStatus.currentPiece) == -1) {
        var animRotateMain = svgAnimate({
          "attributeName": "opacity",
          "from": "1",
          "to": "0",
          "begin": "indefinite",
          "dur": "0.5s",
          "repeatCount": "4",
          "fill": "freeze",
          "id": "notPlayableAnim"
        });
        animRotateMain.addEventListener("endEvent", notPlayable, false);
        drawnCurrentPiece.append(animRotateMain);
        $('[data-valid=true]').each(function() {
          that = $(this);
          var animRotate = svgAnimate({
            "attributeName": "opacity",
            "from": "0",
            "to": "1",
            "begin": "notPlayableAnim.begin",
            "dur": "0.5s",
            "repeatCount": "4",
            "fill": "freeze"
          });
          that.append(animRotate);
        });
        animRotateMain.beginElement();
      } else {
        store.set('gameStatus', gameStatus);
        useStored = false;
        if (gameStatus.playing) {
          if (drawnCurrentPiece === null) {
            drawnCurrentPiece = drawPiece(xToSvg(currentPosX), yToSvg(currentPosY), ESVIJI.settings.pieces[gameStatus.currentPiece - 1], 'playable');
          }
          drawnCurrentPiece.on('mousedown touchstart', cursorStart);
          $("#board").on('mousemove touchmove', cursorMove);
          $("#board").on('mouseup touchend', cursorEnd);
          Mousetrap.bind('up', keyUp);
          Mousetrap.bind('down', keyDown);
          Mousetrap.bind(['enter', 'space'], keyEnter);
        }
      }
    }
  }

  function notPlayable() {
    drawnCurrentPiece.remove();
    drawnCurrentPiece = null;
    removeLife();
    gameStatus.currentPiece = validPieces[Math.floor(Math.random() * validPieces.length)];
    startNewTurn();
  }

  function keyUp(event) {
    cursorY = Math.min(Math.max(yToSvg(currentPosY + 1), cursorMaxY), cursorMinY);
    currentPosY = svgToY(cursorY);
    drawnCurrentPiece.attr({
      y: cursorY
    });
  }

  function keyDown(event) {
    cursorY = Math.min(Math.max(yToSvg(currentPosY - 1), cursorMaxY), cursorMinY);
    currentPosY = svgToY(cursorY);
    drawnCurrentPiece.attr({
      y: cursorY
    });
  }

  function keyEnter(event) {
    Mousetrap.unbind('up');
    Mousetrap.unbind('down');
    Mousetrap.unbind(['enter', 'space']);
    moveCount = 0;
    oldPosX = currentPosX;
    oldPosY = currentPosY;
    playUserChoice();
  }

  function cursorStart(event) {
    event.preventDefault();
    dragged = true;
    drawnCurrentPiece.attr({
      'class': "dragged"
    });
    // if (gameStatus.level < 4) {
      drawPiece(240, yToSvg(currentPosY), 'arrow', 'showAim');
    // }
  }

  function cursorMove(event) {
    event.preventDefault();
    if (dragged) {
      if (event.originalEvent.touches && event.originalEvent.touches.length) {
        event = event.originalEvent.touches[0];
      } else if (event.originalEvent.changedTouches && event.originalEvent.changedTouches.length) {
        event = event.originalEvent.changedTouches[0];
      }
      cursorY = Math.min(Math.max(pixelsToSvgY(event.pageY) - 16, cursorMaxY), cursorMinY);
      currentPosY = svgToY(cursorY);
      drawnCurrentPiece.attr({
        y: cursorY
      });
      // if (gameStatus.level < 4) {
        $('#showAim').attr({
          y: yToSvg(currentPosY)
        });
      // }
    }
  }

  function cursorEnd(event) {
    event.preventDefault();
    if (dragged) {
      if (event.originalEvent.touches && event.originalEvent.touches.length) {
        event = event.originalEvent.touches[0];
      } else if (event.originalEvent.changedTouches && event.originalEvent.changedTouches.length) {
        event = event.originalEvent.changedTouches[0];
      }
      dragged = false;
      drawnCurrentPiece.attr({
        'class': ""
      });
      cursorY = Math.min(Math.max(pixelsToSvgY(event.pageY) - 16, cursorMaxY), cursorMinY);
      currentPosY = svgToY(cursorY);
      drawnCurrentPiece.attr({
        y: yToSvg(currentPosY)
      });
      moveCount = 0;
      oldPosX = currentPosX;
      oldPosY = currentPosY;
      $('#showAim').remove();
      playUserChoice();
    }
  }

  function playUserChoice() {
    moveCount++;
    if (currentPosY == 1 && currentDirY == -1) {
      // Against the floor, no more possible move
      if (oldPosY != 1) {
        animStackMove(drawnCurrentPiece, (oldPosY - currentPosY) * ESVIJI.settings.durationMove, 'y', yToSvg(oldPosY), yToSvg(currentPosY));
      }
      endOfMove();
    } else {
      if (currentPosX == 1 && currentDirX == -1) {
        // Against the left wall, should not go down
        currentDirX = 0;
        currentDirY = -1;
        animStackMove(drawnCurrentPiece, (oldPosX - currentPosX) * ESVIJI.settings.durationMove, 'x', xToSvg(oldPosX), xToSvg(currentPosX));
        oldPosX = currentPosX;
        playUserChoice();
      } else {
        // Neither floor nor wall, so what is it?
        nextPiece = gameStatus.currentPieces[currentPosX + currentDirX][currentPosY + currentDirY];
        switch (nextPiece) {
          case ESVIJI.settings.rockId:
            // A rock...
            if (currentDirX == -1) {
              // ...at our left, should no go down
              currentDirX = 0;
              currentDirY = -1;
              animStackMove(drawnCurrentPiece, (oldPosX - currentPosX) * ESVIJI.settings.durationMove, 'x', xToSvg(oldPosX), xToSvg(currentPosX));
              oldPosX = currentPosX;
              playUserChoice();
            } else {
              // ...under us, no more possible move
              if (oldPosY != currentPosY) {
                animStackMove(drawnCurrentPiece, (oldPosY - currentPosY) * ESVIJI.settings.durationMove, 'y', yToSvg(oldPosY), yToSvg(currentPosY));
              }
              endOfMove();
            }
            break;
          case ESVIJI.settings.emptyId:
            // Nothing can stop us
            currentPosX += currentDirX;
            currentPosY += currentDirY;
            playUserChoice();
            break;
          case gameStatus.currentPiece:
            // Same piece, let's destroy it!
            currentPosXBefore = currentPosX;
            currentPosYBefore = currentPosY;
            currentPosX += currentDirX;
            currentPosY += currentDirY;
            gameStatus.currentPieces[currentPosX][currentPosY] = ESVIJI.settings.emptyId;
            if (currentPosXBefore != oldPosX) {
              animStackMove(drawnCurrentPiece, (oldPosX - currentPosXBefore) * ESVIJI.settings.durationMove, 'x', xToSvg(oldPosX), xToSvg(currentPosXBefore));
              oldPosX = currentPosXBefore;
            } else if (currentPosYBefore != oldPosY) {
              animStackMove(drawnCurrentPiece, (oldPosY - currentPosYBefore) * ESVIJI.settings.durationMove, 'y', yToSvg(oldPosY), yToSvg(currentPosYBefore));
              oldPosY = currentPosYBefore;
            }
            animStackDestroy(drawnCurrentPieces[currentPosX][currentPosY]);
            scoreThisTurn++;
            playUserChoice();
            break;
          default:
            if (currentPosX != oldPosX) {
              animStackMove(drawnCurrentPiece, (oldPosX - currentPosX) * ESVIJI.settings.durationMove, 'x', xToSvg(oldPosX), xToSvg(currentPosX));
            } else if (currentPosY != oldPosY) {
              animStackMove(drawnCurrentPiece, (oldPosY - currentPosY) * ESVIJI.settings.durationMove, 'y', yToSvg(oldPosY), yToSvg(currentPosY));
            }
            if (scoreThisTurn > 0) {
              gameStatus.currentPiece = nextPiece;
              if (currentPosX != oldPosX) {
                animStackMorph(drawnCurrentPiece, nextPiece, xToSvg(currentPosX), yToSvg(currentPosY), 'x', xToSvg(currentPosX), xToSvg(currentPosX + currentDirX));
              } else {
                animStackMorph(drawnCurrentPiece, nextPiece, xToSvg(currentPosX), yToSvg(currentPosY), 'y', yToSvg(currentPosY), yToSvg(currentPosY + currentDirY));
              }
            }
            endOfMove();
        }
      }
    }
  }

  function endOfTurn() {
    for (x = 1; x <= 6; x++) {
      for (y = 1; y <= 7; y++) {
        if (drawnCurrentPieces[x][y] !== null) {
          drawnCurrentPieces[x][y].attr({
            'y': yToSvg(y)
          });
        }
      }
    }
    if (scoreThisTurn === 0) {
      removeLife();
    } else {
      increaseScore(Math.pow(scoreThisTurn, 2));
    }
    stackedAnimationToStart = lastStackedAnimation + 1;
    startNewTurn();
  }

  function svgAnimate(settings) {
    var anim = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    anim.setAttributeNS(null, "attributeType", "xml");
    for (var key in settings) {
      anim.setAttributeNS(null, key, settings[key]);
    }
    return anim;
  }

  function animStackMove(piece, duration, attribute, from, to, begin) {
    if (begin === undefined) {
      if (lastStackedAnimation === (stackedAnimationToStart - 1)) {
        begin = 'indefinite';
      } else {
        begin = 'anim' + lastStackedAnimation + '.end';
      }
    }

    anim = svgAnimate({
      "attributeName": attribute,
      "from": from,
      "to": to,
      "begin": begin,
      "dur": duration + "s",
      "fill": "freeze",
      "id": "anim" + (lastStackedAnimation + 1)
    });
    piece.append(anim);

    lastStackedAnimation++;
  }

  function animStackMorph(pieceFrom, pieceToId, x, y, attribute, from, to) {
    var pieceTo = svgUse("piece" + pieceToId, "morph");
    pieceTo.attr({
      x: x,
      y: y,
      opacity: 0
    });
    $("#board").append(pieceTo);

    // opacity from
    animOpacityFrom = svgAnimate({
      "attributeName": "opacity",
      "to": "0",
      "begin": "anim" + lastStackedAnimation + ".end",
      "dur": ESVIJI.settings.durationMorph + "s",
      "fill": "freeze",
      "id": "anim" + (lastStackedAnimation + 1)
    });
    pieceFrom.append(animOpacityFrom);

    // move
    animMoveFrom = svgAnimate({
      "attributeName": attribute,
      "from": from,
      "to": to,
      "begin": "anim" + lastStackedAnimation + ".end",
      "dur": ESVIJI.settings.durationMorph + "s",
      "fill": "freeze",
      "id": "anim" + (lastStackedAnimation + 2)
    });
    pieceFrom.append(animMoveFrom);

    // opacity to
    animOpacityTo = svgAnimate({
      "attributeName": "opacity",
      "to": "1",
      "begin": "anim" + lastStackedAnimation + ".end",
      "dur": ESVIJI.settings.durationMorph + "s",
      "fill": "freeze",
      "id": "anim" + (lastStackedAnimation + 3)
    });
    pieceTo.append(animOpacityTo);

    // move
    animMoveTo = svgAnimate({
      "attributeName": attribute,
      "from": from,
      "to": to,
      "begin": "anim" + lastStackedAnimation + ".end",
      "dur": ESVIJI.settings.durationMorph + "s",
      "fill": "freeze",
      "id": "anim" + (lastStackedAnimation + 4)
    });
    pieceTo.append(animMoveTo);

    lastStackedAnimation += 4;
  }

  function animStackDestroy(piece, begin) {
    begin = begin || ("anim" + lastStackedAnimation + ".end");

    // rotate
    animRotate = document.createElementNS("http://www.w3.org/2000/svg", "animateTransform");
    animRotate.setAttributeNS(null, "attributeType", "xml");
    animRotate.setAttributeNS(null, "attributeName", "transform");
    animRotate.setAttributeNS(null, "type", "rotate");
    animRotate.setAttributeNS(null, "from", "0 " + (parseInt(piece.attr('x'), 10) + 16) + " " + (parseInt(piece.attr('y'), 10) + 16));
    animRotate.setAttributeNS(null, "to", "360 " + (parseInt(piece.attr('x'), 10) + 16) + " " + (parseInt(piece.attr('y'), 10) + 16));
    animRotate.setAttributeNS(null, "begin", begin);
    animRotate.setAttributeNS(null, "dur", ESVIJI.settings.durationMove + "s");
    animRotate.setAttributeNS(null, "fill", "freeze");
    animRotate.setAttributeNS(null, "id", "anim" + (lastStackedAnimation + 1));
    piece.append(animRotate);

    // opacity
    animOpacity = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    animOpacity.setAttributeNS(null, "attributeType", "xml");
    animOpacity.setAttributeNS(null, "attributeName", "opacity");
    animOpacity.setAttributeNS(null, "to", "0");
    animOpacity.setAttributeNS(null, "begin", begin);
    animOpacity.setAttributeNS(null, "dur", ESVIJI.settings.durationMove + "s");
    animOpacity.setAttributeNS(null, "fill", "freeze");
    animOpacity.setAttributeNS(null, "id", "anim" + (lastStackedAnimation + 2));
    animOpacity.addEventListener("endEvent", function(event) {
      thisPiece = $(event.currentTarget.parentElement);
      thisPiece.remove();
    }, false);
    piece.append(animOpacity);

    lastStackedAnimation += 2;
  }

  function endOfMove() {
    $('#anim' + lastStackedAnimation)[0].addEventListener("endEvent", function(event) {
      drawnCurrentPiece.remove();
      $('#morph').remove();
      drawnCurrentPiece = drawPiece(xToSvg(ESVIJI.settings.turn.posX), yToSvg(ESVIJI.settings.turn.posY), ESVIJI.settings.pieces[gameStatus.currentPiece - 1], 'playable');
    });

    makePiecesFall();
  }

  function makePiecesFall() {
    var abovePieces;

    lastStackedAnimationBeforeFall = lastStackedAnimation;
    for (x = 1; x <= 6; x++) {
      for (y = 1; y <= 7; y++) {
        if (gameStatus.currentPieces[x][y] == ESVIJI.settings.emptyId) {
          abovePieces = 0;
          for (z = y; z <= 6; z++) {
            if (gameStatus.currentPieces[x][z + 1] == ESVIJI.settings.rockId) {
              z = 7;
            } else {
              if (gameStatus.currentPieces[x][z + 1] != ESVIJI.settings.emptyId) {
                abovePieces++;
                gameStatus.currentPieces[x][z] = gameStatus.currentPieces[x][z + 1];
                gameStatus.currentPieces[x][z + 1] = ESVIJI.settings.emptyId;
                animStackMove(drawnCurrentPieces[x][z + 1], ESVIJI.settings.durationMove, 'y', yToSvg(z + 1), yToSvg(z), 'anim' + lastStackedAnimationBeforeFall + '.end');
                drawnCurrentPieces[x][z] = drawnCurrentPieces[x][z + 1];
                drawnCurrentPieces[x][z + 1] = null;
              }
            }
          }
          if (abovePieces > 0) {
            // for multiple empty lines
            y--;
          }
        }
      }
    }

    if (lastStackedAnimation >= stackedAnimationToStart) {
      $('#anim' + lastStackedAnimation)[0].addEventListener("endEvent", function(event) {
        endOfTurn();
      }, false);
      $('#anim' + stackedAnimationToStart)[0].beginElement();
    } else {
      endOfTurn();
    }
  }

  function initPieces(thisLevel) {
    thisLevel = thisLevel || gameStatus.level;
    nbPieces = Math.min(maxAvailablePieces, Math.floor(3 + (thisLevel / 3)));
    gameStatus.currentPieces = [];

    for (x = 1; x <= 9; x++) {
      gameStatus.currentPieces[x] = [];
      for (y = 1; y <= 13; y++) {
        if (x > Math.max(Math.min(thisLevel, 6), 3)) {
          gameStatus.currentPieces[x][y] = ESVIJI.settings.emptyId;
        } else {
          if (y > Math.max(Math.min(thisLevel, 7), 3)) {
            if (y - 7 > x) {
              gameStatus.currentPieces[x][y] = ESVIJI.settings.rockId;
            } else {
              gameStatus.currentPieces[x][y] = ESVIJI.settings.emptyId;
            }
          } else {
            gameStatus.currentPieces[x][y] = 1 + Math.floor(Math.random() * nbPieces);
          }
        }
      }
    }
    // add rocks in the middle after level 10
    if (thisLevel > 8) {
      nbRocks = Math.floor((thisLevel - 6) / 3);
      positionedRocks = 0;
      while (positionedRocks < nbRocks) {
        rock_x = 1 + Math.floor(Math.random() * 6);
        rock_y = 1 + Math.floor(Math.random() * 6);
        if (gameStatus.currentPieces[rock_x][rock_y] !== ESVIJI.settings.rockId) {
          gameStatus.currentPieces[rock_x][rock_y] = ESVIJI.settings.rockId;
          positionedRocks++;
        }
      }
    }
  }

  function drawPiece(x, y, pieceType, pieceId) {
    var piece = svgUse(pieceType, pieceId);
    piece.attr({
      x: x,
      y: y
    });
    $("#board").append(piece);
    return piece;
  }

  function svgUse(refId, useId) {
    var use = $(document.createElementNS("http://www.w3.org/2000/svg", "use"));
    if (useId !== undefined) {
      use.attr({
        id: useId
      });
    }
    use.get(0).setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + refId);
    return use;
  }

  function drawPieces() {
    drawnCurrentPieces = [];
    for (x = 1; x <= 7; x++) {
      drawnCurrentPieces[x] = [];
      for (y = 1; y <= 7; y++) {
        if (gameStatus.currentPieces[x][y] == ESVIJI.settings.emptyId) {
          drawnCurrentPieces[x][y] = null;
        } else {
          piece_x = xToSvg(x);
          piece_y = yToSvg(y);
          if (gameStatus.currentPieces[x][y] == ESVIJI.settings.rockId) {
            rockId = 1 + Math.floor(Math.random() * ESVIJI.settings.rocks.length);
            drawnCurrentPieces[x][y] = drawPiece(piece_x, piece_y, ESVIJI.settings.rocks[rockId - 1]);
          } else {
            drawnCurrentPieces[x][y] = drawPiece(piece_x, piece_y, ESVIJI.settings.pieces[gameStatus.currentPieces[x][y] - 1]);
          }
        }
      }
    }
  }

  function erasePieces() {
    for (x = 1; x <= 9; x++) {
      if (drawnCurrentPieces[x] !== undefined) {
        for (y = 1; y <= 13; y++) {
          if (drawnCurrentPieces[x][y] !== null && drawnCurrentPieces[x][y] !== undefined) {
            drawnCurrentPieces[x][y].remove();
          }
        }
      }
    }
  }

  function getValidPieces() {
    var x, y, dir_x, dir_y, found;

    validPieces = [];

    for (y_start = 1; y_start <= 13; y_start++) {
      x = 10;
      y = y_start;
      dir_x = -1;
      dir_y = 0;
      found = false;
      while (!found) {
        if (y == 1 && dir_y == -1) {
          found = true;
        } else {
          if (x == 1 && dir_x == -1) {
            dir_x = 0;
            dir_y = -1;
          } else {
            nextPiece = gameStatus.currentPieces[x + dir_x][y + dir_y];
            if (nextPiece == ESVIJI.settings.rockId) {
              if (dir_x == -1) {
                dir_x = 0;
                dir_y = -1;
              } else {
                found = true;
              }
            } else {
              if (nextPiece == ESVIJI.settings.emptyId) {
                x += dir_x;
                y += dir_y;
              } else {
                drawnCurrentPieces[x + dir_x][y + dir_y].attr('data-valid', 'true');
                if (validPieces.indexOf(nextPiece) == -1) {
                  validPieces.push(nextPiece);
                }
                found = true;
              }
            }
          }
        }
      }
    }
  }

  function stopPlaying() {
    gameStatus.playing = false;
    gameStatus.level = 0;
    gameStatus.score = 0;
    gameStatus.lives = 0;
    erasePieces();
    if (drawnCurrentPiece !== null) {
      drawnCurrentPiece.remove();
    }
    $('#play').remove();
    store.set('gameStatus', {
      'playing': false
    });
  }

  function pause() {
    _gaq.push(['_trackEvent', 'Pause', 'Start']);
    $('#pausePanel').clone().attr('id', 'pause').appendTo('#board');
    $('#pause .resume').on('click', function() {
      _gaq.push(['_trackEvent', 'Pause', 'Resume']);
      $('#pause').remove();
    });
    $('#pause .restart').on('click', function() {
      _gaq.push(['_trackEvent', 'Pause', 'Restart']);
      $('#pause').remove();
      store.set('gameStatus', {
        'playing': false
      });
      startPlaying();
    });
    $('#pause .exit').on('click', function() {
      _gaq.push(['_trackEvent', 'Pause', 'Exit']);
      $('#pause').remove();
      stopPlaying();
    });
  }

  function gameOver() {
    _gaq.push(['_trackEvent', 'Play', 'Game Over', 'Score', gameStatus.score]);
    $('#gameOverPanel').clone().attr('id', 'gameOver').appendTo('#board');
    $('#gameOver').find('.score').text('Score: ' + gameStatus.score);
    $('.playagain').on('click', function() {
      $('#gameOver').remove();
      startPlaying();
    });
    $('.exit').on('click', function() {
      $('#gameOver').remove();
      stopPlaying();
    });
    gameStatus.playing = false;
    store.set('gameStatus', {
      'playing': false
    });
    vibrate(1000);
  }

  function removeLife() {
    gameStatus.lives--;
    drawLives();
    vibrate(500);
    if (gameStatus.lives === 0) {
      gameOver();
    }
  }

  function addLives(nbLives) {
    gameStatus.lives += nbLives;
    drawLives();
    vibrate(100);
  }

  function increaseScore(scoreToAdd) {
    oldScore = gameStatus.score;
    gameStatus.score += scoreToAdd;
    drawScore();
    hundreds = Math.floor(gameStatus.score / 100) - Math.floor(oldScore / 100);
    if (hundreds > 0) {
      addLives(hundreds);
    }
  }

  function drawScore() {
    $('.score').text(gameStatus.score);
  }

  function drawLevel() {
    $('.level').text(gameStatus.level);
  }

  function drawLives() {
    $('.lives').text(gameStatus.lives);
  }

  function xToSvg(x) {
    return (x - 1) * 32;
  }

  function yToSvg(y) {
    return ESVIJI.settings.board.height - 32 * y;
  }

  function svgToX(coordX) {
    return coordX / 32 + 1;
  }

  function svgToY(coordY) {
    return Math.round((ESVIJI.settings.board.height - coordY) / 32);
  }

  function pixelsToSvgY(coordY) {
    return coordY * ESVIJI.settings.board.height / $(document).height();
  }

  function vibrate(duration) {
    // http://hacks.mozilla.org/2012/01/using-the-vibrator-api-part-of-webapi/
    if (navigator.mozVibrate) {
      navigator.mozVibrate(duration);
    }
  }

  function debug(string) {
    console.log(string);
    matrix = '';
    for (y = 7; y >= 1; y--) {
      for (x = 1; x <= 6; x++) {
        matrix += gameStatus.currentPieces[x][y] + ' ';
      }
      matrix += "\n";
    }
    console.log(matrix);
    console.log('piece: ' + gameStatus.currentPiece + ' | posXY: ' + currentPosX + '/' + currentPosY + ' | dirXY: ' + currentDirX + '/' + currentDirY + ' | stackedAnimationToStart: ' + stackedAnimationToStart + ' | lastStackedAnimation: ' + lastStackedAnimation);
  }

  return {
    init: init
  };
})();

document.addEventListener("DOMContentLoaded", function() {
  ESVIJI.game.init();

  /***************************************************************************************
   * appcache
   ***************************************************************************************/

  // Check if a new cache is available on page load.
  window.addEventListener('load', function(e) {
    window.applicationCache.addEventListener('updateready', function(e) {
      if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
        // Browser downloaded a new app cache.
        // Swap it in and reload the page to get the new hotness.
        window.applicationCache.swapCache();
        if (confirm('A new version is available. Do you want it right now, without losing your game?')) {
          window.location.reload();
        }
      } else {
        // Manifest didn't changed. Nothing new to server.
      }
    }, false);
  }, false);
});