var roleUpgrader = require('role.upgrader')
var roleHarvester = require('role.harvester')
var stats = require('stats')

function builderFilter(s){
    var structHits = s.hitsMax
    if(Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos))
        return false
    if(s.structureType === STRUCTURE_ROAD)
        structHits = 3000
    else if(s.structureType === STRUCTURE_WALL){
        if(39 <= s.pos.x)
            return false
        structHits = 50000
    }
    else if(s instanceof StructureRampart)
        structHits = 50000
    return s.hits < s.hitsMax && s.hits < structHits
}

// Tower and builder both repair structures, but their precedences are different
// in that towers can save cost of time spent for approaching targets.
// Towers are penalized by inefficiency for distant structures, but movement cost
// tend to surpass especially when body count increases after RCL gets high.
function towerBuilderFilter(s){
    var structHits = s.hitsMax
    if(Game.flags.norepair && Game.flags.norepair.pos.isEqualTo(s.pos))
        return false
    if(s.structureType === STRUCTURE_ROAD)
        structHits = 4000
    else if(s.structureType === STRUCTURE_WALL){
        if(39 <= s.pos.x)
            return false
        // The more energy in storage, the more expenses to the defense.
        // It is reasonable to make investments be proportional to asset values.
        // That said, the minimum value for strength should be more than zero
        // if we don't have a container or a storage yet.
        structHits = stats.totalEnergy(s.room)[2] + 10000
    }
    else if(s instanceof StructureRampart)
        structHits = stats.totalEnergy(s.room)[2] + 10000
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

        if(creep.carry.energy == 0) {
            if(deconstructingCreeps < 1 && Game.flags.norepair && 0 < creep.room.find(FIND_STRUCTURES, {filter: s => s.pos.isEqualTo(Game.flags.norepair)}).length){
                creep.memory.task = 'deconstruct'
                creep.say('deconstructing');
            }
            else{
                creep.memory.task = 'harvest'
                creep.memory.target = undefined
                //creep.say('harvesting');
            }
        }
        else if(creep.memory.task !== 'build' && creep.carry.energy == creep.carryCapacity){
            var targets = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
            var targets2 = creep.room.find(FIND_STRUCTURES, {filter: builderFilter});
            if(targets.length || targets2.length) {
                creep.memory.task = 'build';
                creep.memory.resting = false;
                creep.say('building');
            }
        }

        if(creep.memory.task === 'build') {
            var target
            if(creep.memory.target && (target = Game.getObjectById(creep.memory.target))){
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
                    creep.memory.task = 'harvest';
                    creep.memory.target = undefined
                }
            }
        }
        else if(creep.memory.task === 'deconstruct'){
            var target
            if(creep.memory.target && (target = Game.getObjectById(creep.memory.target))){
                console.log('decon target: '+ target.id + ', ' + (target instanceof Structure))
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
                else
                    creep.memory.task = ''
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
