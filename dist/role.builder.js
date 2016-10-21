var roleUpgrader = require('role.upgrader')
var roleHarvester = require('role.harvester')
var stats = require('stats')

function builderFilter(s){
    if(Game.flags.deconstruct && Game.flags.deconstruct.pos.inRangeTo(s.pos, 2))
        return false
    var structHits = s.hitsMax
    if(Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos))
        return false
    if(s.structureType === STRUCTURE_ROAD)
        structHits = s.hitsMax * .6
    else if(s.structureType === STRUCTURE_WALL){
        if(s.room.controller && 2 < s.room.controller.level)
            structHits = 50000
        else
            structHits = 100
    }
    else if(s instanceof StructureRampart)
        structHits = 50000
    else if(s instanceof StructureContainer)
        structHits = s.hitsMax * .8 // Containers frequently degrade, so prevent overreacting
    return s.hits < s.hitsMax && s.hits < structHits
}

// Tower and builder both repair structures, but their precedences are different
// in that towers can save cost of time spent for approaching targets.
// Towers are penalized by inefficiency for distant structures, but movement cost
// tend to surpass especially when body count increases after RCL gets high.
function towerBuilderFilter(s){
    if(Game.flags.deconstruct && Game.flags.deconstruct.pos.inRangeTo(s.pos, 2))
        return false
    var structHits = s.hitsMax
    if(Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos))
        return false
    if(s.structureType === STRUCTURE_ROAD)
        structHits = s.hitsMax * .8
    else if(s.structureType === STRUCTURE_WALL){
        // The more energy in storage, the more expenses to the defense.
        // It is reasonable to make investments be proportional to asset values.
        // That said, the minimum value for strength should be more than zero
        // if we don't have a container or a storage yet.
        structHits = stats.totalEnergy(s.room)[2] + 10000
    }
    else if(s instanceof StructureRampart)
        structHits = stats.totalEnergy(s.room)[2] + 10000
    else if(!s.my)
        return false
    return s.hits < s.hitsMax && s.hits < structHits
}

function findDamagedStructures(room){
    return room.find(FIND_STRUCTURES, {
        filter: s => towerBuilderFilter(s)
    });
}

function countTasks(task){
    return _.filter(Game.creeps, c => c.memory.task === task).length
}


var roleBuilder = {

    builderFilter: builderFilter,

    findDamagedStructures: findDamagedStructures,

    /** @param {Creep} creep **/
    run: function(creep) {

        var deconstructingCreeps = countTasks('deconstruct')

        //console.log(creep.name + ': decon: ' + deconstructingCreeps + ' task: ' + creep.memory.task + ' en: ' + creep.carry.energy)

        if(creep.memory.task === 'deconstruct' && 1 < deconstructingCreeps){
            creep.memory.task = ''
            deconstructingCreeps--
        }

        if(_.sum(creep.carry) === 0) {
            if(deconstructingCreeps < 1 && (
                Game.flags.norepair && 0 < creep.room.find(FIND_STRUCTURES, {filter: s => s.pos.isEqualTo(Game.flags.norepair)}).length ||
                Game.flags.deconstruct))
            {
                creep.memory.task = 'deconstruct'
                creep.say('deconstructing');
            }
        }
        else if(0 < _.sum(creep.carry) - creep.carry.energy){
            // Store the minerals before trying to build
            creep.memory.task = undefined
        }
        else if(creep.memory.task !== 'build' && _.sum(creep.carry) === creep.carryCapacity){
            var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
            var targets2 = creep.room.find(FIND_STRUCTURES, {filter: builderFilter});
            if(targets.length || targets2.length) {
                creep.memory.task = 'build';
                creep.memory.resting = false;
                creep.say('building');
            }
            else{
                for(let r in Game.rooms){
                    let room = Game.rooms[r]
                    if(room === creep.room)
                        continue
                    let targets = room.find(FIND_MY_CONSTRUCTION_SITES)
                    if(0 < targets.length){
                        creep.memory.room = room.name
                        creep.memory.task = 'build'
                        creep.say('remote')
                    }
                    else{
                        let targets = room.find(FIND_MY_STRUCTURES, {filter: builderFilter})
                        if(0 < targets.length){
                            creep.memory.room = room.name
                            creep.memory.task = 'build'
                            creep.say('remote repair')
                        }
                    }
                }
            }
        }

        if(creep.memory.task === 'build') {
            var target
            if(creep.memory.room){
                if(creep.memory.room !== creep.room.name)
                    creep.moveTo(new RoomPosition(25, 25, creep.memory.room))
                else
                    creep.memory.room = undefined
            }
            else if(creep.carry.energy === 0){
                creep.memory.task = 'harvest'
                creep.memory.target = undefined
            }
            else if(creep.memory.target && (target = Game.getObjectById(creep.memory.target))){
                //console.log('builder target: '+ target.id + ', ' + (target instanceof Structure))
                if(target instanceof Structure){
                    if(target.hits === target.hitsMax){
                        creep.memory.target = undefined
                    }
                    else if(creep.repair(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                }
                else if(target instanceof ConstructionSite){
                    if(creep.build(target) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(target);
                    }
                }
                else
                    creep.memory.target = undefined;
            }
            else{
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER || Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos)
                });
                if(target && false){
                    creep.memory.target = target.id
                }
                else{
                    var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: builderFilter});
                    if(target){
                        creep.memory.target = target.id
                    }
                    else{
                        var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
                        if(targets.length) {
                            creep.memory.target = targets[0].id
                        }
                        else
                            creep.memory.target = undefined
                    }
                }
                if(!creep.memory.target){
                    creep.memory.task = undefined
                    creep.memory.target = undefined
                }
            }
        }
        else if(creep.memory.task === 'deconstruct'){
            var target
            if(creep.memory.target && (target = Game.getObjectById(creep.memory.target))){
                //console.log('decon target: '+ target.id + ', ' + (target instanceof Structure))
                if(target instanceof Structure){
                    if(Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(target.pos)){
                        if(ERR_NOT_IN_RANGE === creep.dismantle(target))
                            creep.moveTo(target)
                    }
                }
            }
            else{
                var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: s => Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos)
                });
                if(target){
                    creep.memory.target = target.id
                    creep.say('deconstructing')
                }
                else{
                    var flag = Game.flags.deconstruct
                    if(flag){
                        if(flag.room !== creep.room)
                            creep.moveTo(flag)
                        else{
                            let targets = flag.pos.findInRange(FIND_STRUCTURES, 2, {filter: s=>s.structureType === STRUCTURE_WALL})
                            if(targets.length){
                                targets.sort((a,b)=>a.hits-b.hits)
                                if(ERR_NOT_IN_RANGE === creep.dismantle(targets[0]))
                                    creep.moveTo(targets[0])
                            }
                            else
                                creep.memory.task = undefined
                        }
                    }
                    else
                        creep.memory.task = undefined
                }
            }
        }
        else{
            // Delegate logic to harvester altogether since harvester has more
            // sophisticated precedence.
            roleHarvester.run(creep)
        }
    }
};

module.exports = roleBuilder;
