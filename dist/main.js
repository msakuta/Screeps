var roleHarvester = require('role.harvester');
var roleAttacker = require('role.attacker');
var roleDigger = require('role.digger');
var roleClaimer = require('role.claimer');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleRanger = require('role.ranger');
var roleInterceptor = require('role.interceptor');
var roleTransporter = require('role.transporter');
var stats = require('stats')

var bodyCosts = {
    [MOVE]: 50, [WORK]: 100, [CARRY]: 50, [ATTACK]: 80, [RANGED_ATTACK]: 150, [HEAL]: 250, [CLAIM]: 600, [TOUGH]: 10
}

function countBodyCost(creep){
    var ret = 0
    for(var i = 0; i < creep.body.length; i++)
        ret += bodyCosts[creep.body[i].type]
    return ret
}

function tryCreateCreepInt(role, priority, bodyCandidates, spawn){
    spawn = spawn || Game.spawns.Spawn1
    var maxCandidate = bodyCandidates.length - (priority || 0)
    for(var i = 0; i < maxCandidate; i++){
        var body = bodyCandidates[i];
        if(0 <= spawn.canCreateCreep(body))
            break;
    }
    if(i === maxCandidate){
        return false;
    }
    var newName = spawn.createCreep(body, undefined, {role: role});
    var partsStr = ''
    for(var i = 0; i < body.length; i++)
        partsStr += body[i][0]
    console.log('[' + spawn.name + '] Spawning new ' + role + ': ' + partsStr + ', name: ' + newName);
    if(!Memory.spent)
        Memory.spent = {}
    Memory.spent[role] = (Memory.spent[role] || 0) + countBodyCost(Game.creeps[newName])
    return true
}

function tryCreateCreep(role, priority, spawn){
    return tryCreateCreepInt(role, priority, [
        [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE],
        [WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE],
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

function calcStoredEnergy(room){
    var storedEnergy = 0, storedEnergyCapacity = 0
    let containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE})
    for(let j = 0; j < containers.length; j++){
        storedEnergy += containers[j].store.energy
        storedEnergyCapacity += containers[j].storeCapacity
    }
    return [storedEnergy, storedEnergyCapacity]
}

function logStats(){
    var energy = 0, energyCapacity = 0
    var storedEnergy = 0, storedEnergyCapacity = 0
    var source = 0
    for(let i in Game.rooms){
        let r = Game.rooms[i]
        energy += r.energyAvailable
        energyCapacity += r.energyCapacityAvailable

        let stored = calcStoredEnergy(r)
        storedEnergy += stored[0]
        storedEnergyCapacity += stored[1]

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

    stats.resetCache()

    // We need status report only infrequently
    if(Game.time % 10 === 0){
        stats.stats()
        // Debug check for contents of total energy array cache
/*        let ss = ''
        for(let s in stats.totalEnergyCache){
            if(s !== 'time')
                ss += s + ' ' + stats.totalEnergyCache[s] + ', '
        }
        console.log('totalEnergyCache: ' + ss)*/
    }

    // Control turrets
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

    // Control links
    for(var name in Game.rooms){
        var room = Game.rooms[name]
        if(room.storage){
            let links = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_LINK}})
            for(var j = 0; j < links.length; j++) {
                let link = links[j]
                let range = link.pos.getRangeTo(room.storage)
                link.range = range
            }

            links.sort((a,b) => a.range - b.range)

            if(2 <= links.length){
                // Cache sink and source flags to use for harvesters
                links[0].sink = true
                for(let j = 1; j < links.length; j++){
                    // We need at least 100 space in order to transport to the sink
                    // because it would be so inefficient unless we do.
                    if(links[0].energy + Math.min(links[j].energy, 100) < links[0].energyCapacity)
                        links[j].transferEnergy(links[0])
                    links[j].source = true
                }
                //console.log('links sink: ' + links[0] + ', source: ' + links[1])
            }
            room.links = links
        }
    }


    roleHarvester.sortDistance()

    var spawnCount = 0
    for(let key in Game.spawns)
        spawnCount++

    // Spawn harvesters
    var totalHarvesterCount = _.filter(Game.creeps, c => c.memory.role === 'harvester').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let harvesterCost = 0
        let harvesterCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'harvester' && Game.creeps[i].room === spawn.room){
                harvesterCost += countBodyCost(Game.creeps[i])
                harvesterCount++
            }
        }
        let energy = stats.totalEnergy(spawn.room)
        spawn.room.energy = energy // cache stats for later use
        //console.log('harvesterCost: ' + harvesterCost + ', energy: ' + energy[0] + '/' + energy[2])

        let sourceCount = spawn.room.find(FIND_SOURCES).length;

        if(harvesterCount < sourceCount && harvesterCost * 2 < energy[0] + energy[2] && totalHarvesterCount < spawnCount * (sourceCount + 1)) {
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
    var maxClaimers = controllers === Game.gcl.level ? 1 : Math.min(2, Math.floor(Memory.storedEnergyHistory[Memory.storedEnergyHistory.length-1] / 5e4))

    // Debug output
    //console.log('controllers: ' + controllers + ', gcl: ' + Game.gcl.level + ', maxClaimers: ' + maxClaimers)

    if(claimers.length < maxClaimers) {
        tryCreateCreepInt('claimer', 0, [
            [CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,MOVE,MOVE],
            [CLAIM,CLAIM,MOVE,MOVE],
            [CLAIM,MOVE],
        ])
    }

    // Spawn builders
    var totalBuilderCount = _.filter(Game.creeps, c => c.memory.role === 'builder').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]
        let builderCost = 0
        let builderCount = 0
        for(let i in Game.creeps){
            if(Game.creeps[i].memory.role === 'builder' && Game.creeps[i].room === spawn.room){
                builderCost += countBodyCost(Game.creeps[i])
                builderCount++
            }
        }

        // You don't really need more than 2 builders
        let creepsPerSpawn = (1 + (3 < spawn.room.controller.level))
        if(builderCount < creepsPerSpawn && builderCost * 2 < spawn.room.energy[0] + spawn.room.energy[2] && totalBuilderCount < spawnCount * creepsPerSpawn) {
            tryCreateCreep('builder', spawn.room.controller.level - 1, spawn)
        }
    }

    // Spawn diggers
    var totalDiggerCount = _.filter(Game.creeps, c => c.memory.role === 'digger').length
    for(let key in Game.spawns){
        let spawn = Game.spawns[key]

        if(totalDiggerCount < 2){
            if(tryCreateCreepInt('digger', 0, [
                [WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE]
            ], spawn))
                totalDiggerCount++
        }
    }

    var rangers = _.filter(Game.creeps, (creep) => creep.memory.role == 'ranger');
    var maxRangers = roleRanger.countSites();

    // If we see an enemy in the room, reinforce attack force.
    if(0 < Game.spawns.Spawn1.room.find(FIND_HOSTILE_CREEPS).length)
        maxRangers++

    // Spawn rangers
    if(rangers.length < maxRangers) {
        tryCreateCreepInt('ranger', 0, [
            [TOUGH,TOUGH,TOUGH,TOUGH,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE],
            [TOUGH,TOUGH,TOUGH,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE,RANGED_ATTACK,MOVE,MOVE]
            [RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE,RANGED_ATTACK,MOVE]
        ])
    }

    var interceptors = _.filter(Game.creeps, (creep) => creep.memory.role == 'interceptor');
    var maxInterceptors = !!roleInterceptor.findEnemy();

    // Spawn interceptors
    if(interceptors.length < maxInterceptors) {
        tryCreateCreepInt('interceptor', 0, [
            [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL]
            [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL]
            [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL]
            [MOVE,MOVE,MOVE,RANGED_ATTACK,ATTACK,RANGED_ATTACK,MOVE,HEAL]
        ])
    }

    // Spawn upgraders
    var totalUpgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader').length
    for(let key in Game.spawns){
        var spawn = Game.spawns[key]
        var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role === 'upgrader' && creep.room === spawn.room);
        var maxUpgraders = (spawn.room.controller.level + 1) / 2;
        if(Memory.stats && 0 < Memory.stats.restingCreeps)
            maxUpgraders += Memory.stats.restingCreeps;
        let stored = calcStoredEnergy(spawn.room)
        if(1600 < stored[0])
            maxUpgraders += 1;
        if(100000 < stored[0])
            maxUpgraders += 1;

        // console.log(upgraders.length + '/' + maxUpgraders)
        if(upgraders.length < maxUpgraders && totalUpgraders < spawnCount * maxUpgraders * 1.5) {
            tryCreateCreep('upgrader',4,spawn)
        }
    }

    // Create transporters
    let transporters = _.filter(Game.creeps, creep => creep.memory.role === 'transporter').length
    for(let spawnName in Game.spawns){
        let spawn = Game.spawns[spawnName]
        if(transporters < 3){
            // Create body candidates with as much capacity as possible
            let transporterBodyCandidates = []
            for(let i = 10; 0 <= i; i--){
                let body = [WORK,CARRY,MOVE]
                for(let j = 0; j < i; j++){
                    body.push(CARRY,CARRY,MOVE)
                }
                transporterBodyCandidates.push(body)
//                console.log('body: ' + i + ': ' + body)
            }
            if(tryCreateCreepInt('transporter', 0, transporterBodyCandidates, spawn))
                transporters++
        }
    }

    var roles = {
        harvester: roleHarvester.run,
        builder: roleBuilder.run,
        digger: roleDigger.run,
        attacker: roleAttacker.run,
        claimer: roleClaimer.run,
        ranger: roleRanger.run,
        interceptor: roleInterceptor.run,
        transporter: roleTransporter.run,
        upgrader: roleUpgrader.run,
    }

    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        var run = roles[creep.memory.role]
        if(run)
            run(creep)
    }

    for(let r in Game.rooms){
        let room = Game.rooms[r]
        let sources = room.find(FIND_SOURCES)
        for(let s in sources){
            let source = sources[s]
            if(source.harvesters)
                console.log(room.name + ': ' + source.pos.x + ', ' + source.pos.y + ': ' + source.harvesters)
        }
    }

    logStats()

    Memory.lastTick = Game.time
}
