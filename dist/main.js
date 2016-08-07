var roleHarvester = require('role.harvester');
var roleAttacker = require('role.attacker');
var roleClaimer = require('role.claimer');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRanger = require('role.ranger');
var stats = require('stats')

function tryCreateCreepInt(role, priority, bodyCandidates, spawn){
    spawn = spawn || Game.spawns.Spawn1
    var maxCandidate = bodyCandidates.length - (priority || 0)
    for(var i = 0; i < maxCandidate; i++){
        var body = bodyCandidates[i];
        if(0 <= spawn.canCreateCreep(body))
            break;
    }
    if(i === maxCandidate){
        return;
    }
    var newName = spawn.createCreep(body, undefined, {role: role});
    var partsStr = ''
    for(var i = 0; i < body.length; i++)
        partsStr += body[i][0]
    console.log('[' + spawn.name + '] Spawning new ' + role + ': ' + partsStr + ', name: ' + newName);
}

function tryCreateCreep(role, priority, spawn){
    return tryCreateCreepInt(role, priority, [
        [WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
        [WORK,WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,WORK,CARRY,MOVE,MOVE],
        [WORK,CARRY,CARRY,MOVE,MOVE],
        [WORK,CARRY,MOVE]
    ], spawn)
}

function logStats(){
    var energy = 0, energyCapacity = 0
    var storedEnergy = 0, storedEnergyCapacity = 0
    var source = 0
    for(let i in Game.rooms){
        let r = Game.rooms[i]
        energy += r.energyAvailable
        energyCapacity += r.energyCapacityAvailable

        let containers = r.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE})
        for(let j = 0; j < containers.length; j++){
            storedEnergy += containers[j].store.energy
            storedEnergyCapacity += containers[j].storeCapacity
        }

        let sources = r.find(FIND_SOURCES)
        for(let j = 0; j < sources.length; j++)
            source += sources[j].energy
    }

    var historyLength = 1000
    function appendHistory(key, value){
        if(Memory[key] === undefined)
            Memory[key] = []
        Memory[key].push(value)
        while(historyLength < Memory[key].length)
            Memory[key].splice(0,1)
    }

    appendHistory('energyHistory', energy)
    appendHistory('storedEnergyHistory', storedEnergy)
    appendHistory('sourceHistory', source)
    appendHistory('cpuHistory', Game.cpu.getUsed())
}


module.exports.loop = function () {

    if(Memory.lastTick < Game.time-1)
        console.log(Memory.lastTick + '-' + Game.time + ' CPU overdraft!')

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            // console.log('Clearing non-existing creep memory:', name);
        }
    }

    // We need status report only infrequently
    if(Game.time % 10 === 0){
        stats.stats()
    }

    for(var name in Game.rooms){
        var room = Game.rooms[name]
        var towers = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}})
        for(var j = 0; j < towers.length; j++) {
            var tower = towers[j]
            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                tower.attack(closestHostile);
            }
            else if(tower.energyCapacity / 2 < tower.energy){
                var damagedStructures = roleBuilder.findDamagedStructures(tower.room)
                if(0 < damagedStructures.length) {
                    damagedStructures.sort((a,b) => a.hits - b.hits)
                    tower.repair(damagedStructures[0]);
                }
            }

        }
    }

    roleHarvester.sortDistance()

    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');

        if(harvesters.length < 2 + 1) {
            tryCreateCreep('harvester', 0, spawn)
        }
    }

    // There's no siple way to obtain number of controllers under the player's control
    var controllers = (() => {
        var ret = 0
        for(let k in Game.rooms){
            if(Game.rooms[k].controller && Game.rooms[k].controller.my)
                ret++
        }
        return ret
    })()

    var attackers = _.filter(Game.creeps, (creep) => creep.memory.role == 'attacker');
    var maxAttackers = (controllers < 2) * Math.min(3, Math.floor(Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1] / 5e4))

    if(attackers.length < maxAttackers) {
        tryCreateCreepInt('attacker', 0, [
            [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
            [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE],
        ])
    }

    var claimers = _.filter(Game.creeps, (creep) => creep.memory.role === 'claimer');
    // Let's stop generating claimers if maximum number of controllable rooms is reached.
    // Technically it may have benefit because claimers can also reserve, but we'll ignore it for now.
    var maxClaimers = controllers === Game.gcl.level ? 0 : Math.min(2, Math.floor(Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1] / 5e4))

    // Debug output
    //console.log('controllers: ' + controllers + ', gcl: ' + Game.gcl.level + ', maxClaimers: ' + maxClaimers)

    if(claimers.length < maxClaimers) {
        tryCreateCreepInt('claimer', 0, [
            [CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,MOVE,MOVE],
            [CLAIM,MOVE,MOVE],
        ])
    }

    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        if(spawn !== 'Spawn1')
            continue
        var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder' && spawn.room === creep.room);

        if(builders.length < (2 + spawn.room.controller.level / 3)) {
            tryCreateCreep('builder', spawn.room.controller.level - 1, spawn)
        }
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');
    var maxRangers = roleRanger.countSites();

    // If we see an enemy in the room, reinforce attack force.
    if(0 < Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length)
        maxRangers++

    if(rangers.length < maxRangers) {
        tryCreateCreepInt('ranger', 0, [
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE],
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE]
        ])
    }

    var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');
    var maxUpgraders = 3;
    if(Memory.stats && 0 < Memory.stats.restingCreeps)
        maxUpgraders += Memory.stats.restingCreeps;
    if(1600 < Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1])
        maxUpgraders += 1;
    if(100000 < Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1])
        maxUpgraders += 1;

    if(upgraders.length < maxUpgraders) {
        tryCreateCreep('upgrader',4)
    }


    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role === 'attacker')
            roleAttacker.run(creep)
        if(creep.memory.role === 'claimer')
            roleClaimer.run(creep)
        if(creep.memory.role === 'ranger')
            roleRanger.run(creep)
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }

    logStats()

    Memory.lastTick = Game.time
}
