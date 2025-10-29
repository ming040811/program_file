document.addEventListener('DOMContentLoaded', () => {
    const mainCanvasFrame = document.querySelector('.main-canvas-frame');
    const touchPadsWrapper = document.querySelector('.touch-pads-wrapper');
    const deleteButton = document.getElementById('delete-selected-deco');
    const controlGroupWrapper = document.querySelector('.control-group-wrapper');

    let currentDecoList = []; 
    let selectedDecoIds = []; // 다중 선택 배열

    // --- 1. 메시지 전송 함수 (변경 없음) ---
    function sendMessage(type, data = {}) {
        if (window.opener) {
            window.opener.postMessage({ type, ...data }, '*');
        }
    }

    // --- 2. 터치패드 업데이트 (변경 없음) ---
    function updateTouchPads() {
        touchPadsWrapper.innerHTML = ''; 

        const frameWidth = mainCanvasFrame.offsetWidth;
        const frameHeight = mainCanvasFrame.offsetHeight;

        currentDecoList.forEach((deco, index) => {
            const pad = document.createElement('button');
            pad.classList.add('touch-pad');
            pad.id = `touch-pad-${deco.id}`;
            pad.dataset.id = deco.id;
            pad.title = `아이템 ${index + 1} 선택 및 이동`;

            const pixelX = deco.x * frameWidth;
            const pixelY = deco.y * frameHeight;

            pad.style.left = `${pixelX}px`;
            pad.style.top = `${pixelY}px`;
            pad.style.opacity = '1';

            if (selectedDecoIds.includes(deco.id)) {
                pad.classList.add('selected');
            }

            // 3. 클릭 (다중 선택) 이벤트 리스너 (변경 없음)
            pad.addEventListener('click', (e) => {
                e.stopPropagation();
                const decoId = deco.id; 
                const isSelected = selectedDecoIds.includes(decoId);

                if (isSelected) {
                    selectedDecoIds = selectedDecoIds.filter(id => id !== decoId);
                } else {
                    if (selectedDecoIds.length < 2) {
                        selectedDecoIds.push(decoId);
                    } else {
                        selectedDecoIds.shift(); 
                        selectedDecoIds.push(decoId);
                    }
                }
                
                sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds }); 
                updateTouchPads();
            });

            // 드래그 이벤트 추가
            pad.addEventListener('mousedown', initDrag);
            pad.addEventListener('touchstart', initDrag, { passive: true });

            touchPadsWrapper.appendChild(pad);
        });

        const isSelected = selectedDecoIds.length > 0;
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.disabled = !isSelected;
        });
        deleteButton.disabled = !isSelected;
        controlGroupWrapper.classList.toggle('active', isSelected);
    }

    // --- 4. 터치패드 이동 (드래그) 구현 (⭐ 로직 수정) ---
    function initDrag(e) {
        const targetPad = e.currentTarget;
        const decoId = targetPad.dataset.id;

        // 1. 만약 선택되지 않은 패드를 드래그했다면,
        //    선택 목록을 초기화하고 이 패드만 선택
        if (!selectedDecoIds.includes(decoId)) {
            selectedDecoIds = [decoId];
            sendMessage('DECO_SELECT_MULTI', { ids: selectedDecoIds });
            updateTouchPads(); // UI를 즉시 업데이트
        }
        
        // 2. (선택이 0개면) 드래그 중지
        if (selectedDecoIds.length === 0) {
            return; 
        }

        e.preventDefault();

        const isTouch = e.type.startsWith('touch');
        // 마우스/손가락의 '마지막' 위치를 저장 (델타 계산용)
        let lastX = isTouch ? e.touches[0].clientX : e.clientX;
        let lastY = isTouch ? e.touches[0].clientY : e.clientY;

        const frameRect = mainCanvasFrame.getBoundingClientRect();
        const frameWidth = frameRect.width;
        const frameHeight = frameRect.height;
        
        // 드래그할 모든 패드 요소를 미리 찾아둠
        const padsToDrag = {};
        for (const id of selectedDecoIds) {
            const pad = document.getElementById(`touch-pad-${id}`);
            if(pad) padsToDrag[id] = pad;
        }

        function drag(e_move) {
            const currentX = isTouch ? e_move.touches[0].clientX : e_move.clientX;
            const currentY = isTouch ? e_move.touches[0].clientY : e_move.clientY;

            // 마지막 프레임 대비 마우스/손가락 이동 거리 계산
            const dx = currentX - lastX;
            const dy = currentY - lastY;

            // ⭐ 선택된 모든 패드에 이동 거리를 동일하게 적용
            for (const id in padsToDrag) {
                const pad = padsToDrag[id];
                
                // 패드의 현재 위치
                let currentPadLeft = parseFloat(pad.style.left);
                let currentPadTop = parseFloat(pad.style.top);

                // 새 위치 계산
                let newPadLeft = currentPadLeft + dx;
                let newPadTop = currentPadTop + dy;

                // 경계선 처리
                const padHalf = pad.offsetWidth / 2;
                newPadLeft = Math.max(padHalf, Math.min(newPadLeft, frameWidth - padHalf));
                newPadTop = Math.max(padHalf, Math.min(newPadTop, frameHeight - padHalf));

                // 1. 스타일 업데이트 (즉각적인 시각적 피드백)
                pad.style.left = `${newPadLeft}px`;
                pad.style.top = `${newPadTop}px`;
                
                const newNormX = newPadLeft / frameWidth;
                const newNormY = newPadTop / frameHeight;

                // 2. 로컬 데이터 업데이트 (손 뗐을 때 제자리로 안 돌아가게)
                const deco = currentDecoList.find(d => d.id === id);
                if (deco) {
                    deco.x = newNormX;
                    deco.y = newNormY;
                }

                // 3. 메인 창으로 이동 메시지 전송
                sendMessage('DECO_CONTROL', {
                    id: id,
                    action: 'move',
                    x: newNormX,
                    y: newNormY
                });
            }

            // 다음 프레임 계산을 위해 '마지막' 위치 업데이트
            lastX = currentX;
            lastY = currentY;
        }

        function stopDrag() {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', stopDrag);
        }

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    // --- 5. 회전/크기/정렬 버튼 (변경 없음) ---
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (selectedDecoIds.length === 0 || btn.disabled) return;

            const action = btn.dataset.action;
            const direction = btn.dataset.direction;

            sendMessage('DECO_CONTROL_MULTI', { 
                ids: selectedDecoIds, 
                action: action, 
                direction: direction 
            });
        });
    });

    // --- 6. 삭제 버튼 (변경 없음) ---
    deleteButton.addEventListener('click', () => {
        if (selectedDecoIds.length === 0 || deleteButton.disabled) return;
        
        sendMessage('DECO_DELETE_MULTI', { ids: selectedDecoIds });
        selectedDecoIds = []; 
        updateTouchPads();
    });


    // --- 7. 메시지 수신 (변경 없음) ---
    window.addEventListener('message', (event) => {
        if (event.data.type === 'DECO_LIST_UPDATE') {
            currentDecoList = event.data.data;
            selectedDecoIds = event.data.selectedIds || []; 
            updateTouchPads();
        }
    });

    // --- 8. 초기 요청 (변경 없음) ---
    window.onload = () => {
        // sendMessage('REQUEST_DECO_LIST');
        request_dummy_list(); // 테스트용 더미
    };

    function request_dummy_list() {
        console.log("더미 아이템 생성 중...");
        currentDecoList = [
            { id: 'item1', x: 0.25, y: 0.3, rotation: 0, scale: 1 },
            { id: 'item2', x: 0.5, y: 0.6, rotation: 0, scale: 1 },
            { id: 'item3', x: 0.75, y: 0.9, rotation: 0, scale: 1 }
        ];
        selectedDecoIds = ['item1']; 
        updateTouchPads();
    }

    window.addEventListener('resize', () => {
        updateTouchPads();
    });
});
